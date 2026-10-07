import { PEOPLE, scanMailbox, tasksByPerson } from './focus-scan.js'

const DONE_KEY = 'tch.focus.done'
const mailboxUrl = new URL('../data/mailbox.json', import.meta.url)

const root = document.querySelector('[data-desk]')
const live = document.querySelector('[data-live]')
const toast = document.querySelector('[data-toast]')
const toastLabel = document.querySelector('[data-toast-label]')
const undoBtn = document.querySelector('[data-undo]')

let allTasks = []
let scannedAt = ''
let pendingUndo = null

function readDone() {
  try {
    const raw = JSON.parse(localStorage.getItem(DONE_KEY) || '[]')
    return Array.isArray(raw) ? raw.map(String) : []
  } catch {
    return []
  }
}

function writeDone(ids) {
  localStorage.setItem(DONE_KEY, JSON.stringify(ids))
}

function formatDay(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function visibleTasks() {
  const done = new Set(readDone())
  return allTasks.filter((task) => !done.has(task.id))
}

function render() {
  if (!root) return
  const tasks = visibleTasks()
  const grouped = tasksByPerson(tasks)
  const scanned = scannedAt ? `Last scan ${formatDay(scannedAt)}` : 'Mailbox scan ready'

  root.innerHTML = `
    <p class="intro">Focus Points from mail that mentions <strong>deadline</strong>, <strong>new business</strong>, <strong>trusty</strong>, <strong>quote</strong>, <strong>new work</strong> or <strong>urgent</strong>. Tick a point when it is done or no longer important and it leaves the list.</p>
    <p class="meta"><span>${escapeHtml(scanned)}</span><span>${tasks.length} open</span></p>
    <div class="board">
      ${PEOPLE.map((person) => personColumn(person, grouped[person.id] || [])).join('')}
    </div>
  `
}

function personColumn(person, tasks) {
  const count = tasks.length === 1 ? '1 point' : `${tasks.length} points`
  const body = tasks.length
    ? `<ul class="tasks">${tasks.map(taskCard).join('')}</ul>`
    : `<p class="empty">No matching mail for ${escapeHtml(person.name)}.</p>`
  return `
    <section class="person" data-person="${escapeHtml(person.id)}">
      <header class="person-head">
        <h2>${escapeHtml(person.name)}</h2>
        <span class="count">${escapeHtml(count)}</span>
      </header>
      ${body}
    </section>
  `
}

function taskCard(task) {
  const when = formatDay(task.received)
  const tags = task.keywords.map((word) => `<span class="tag">${escapeHtml(word)}</span>`).join('')
  return `
    <li>
      <article class="task" data-task="${escapeHtml(task.id)}">
        <input class="tick" type="checkbox" data-tick="${escapeHtml(task.id)}" aria-label="Clear: ${escapeHtml(task.title)}">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.from)}${when ? ` · ${escapeHtml(when)}` : ''}</p>
          ${task.snippet ? `<p>${escapeHtml(task.snippet)}</p>` : ''}
          <div class="tags">${tags}</div>
        </div>
      </article>
    </li>
  `
}

function announce(text) {
  if (live) live.textContent = text
}

function hideToast() {
  if (!toast) return
  toast.hidden = true
  pendingUndo = null
}

function showUndo(task) {
  pendingUndo = task
  if (toastLabel) toastLabel.textContent = `Cleared ${task.personName}'s point`
  if (toast) toast.hidden = false
  window.clearTimeout(showUndo.timer)
  showUndo.timer = window.setTimeout(hideToast, 6000)
}

function tickTask(id, checkbox) {
  const task = allTasks.find((row) => row.id === id)
  if (!task) return
  const card = checkbox.closest('.task')
  const done = readDone()
  if (!done.includes(id)) writeDone([...done, id])
  announce(`${task.title} cleared`)
  showUndo(task)
  const finish = () => render()
  if (card && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.classList.add('leaving')
    window.setTimeout(finish, 180)
  } else {
    finish()
  }
}

function undoLast() {
  if (!pendingUndo) return
  writeDone(readDone().filter((id) => id !== pendingUndo.id))
  announce(`${pendingUndo.title} restored`)
  hideToast()
  render()
}

root?.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const id = target.getAttribute('data-tick')
  if (!id || !target.checked) return
  tickTask(id, target)
})

undoBtn?.addEventListener('click', undoLast)

export async function loadDesk() {
  try {
    const res = await fetch(mailboxUrl)
    if (!res.ok) throw new Error('Mailbox scan could not be loaded')
    const pack = await res.json()
    scannedAt = pack.scannedAt || ''
    allTasks = scanMailbox(pack.messages || [], { doneIds: [] })
    render()
  } catch (error) {
    if (root) {
      root.innerHTML = `<p class="status">${escapeHtml(error.message || 'Mailbox scan failed')}</p>`
    }
  }
}

loadDesk()
