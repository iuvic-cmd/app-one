// Простая версия Блокнота
let notes = JSON.parse(localStorage.getItem('superNotes')) || [];

document.addEventListener('DOMContentLoaded', () => {
    alert('Блокнот загружен!');
    renderNotes();
    
    document.getElementById('addNoteBtn').addEventListener('click', () => {
        const title = prompt('Заголовок заметки:');
        if (title) {
            notes.push({
                id: Date.now() + '',
                title: title,
                content: '',
                updatedAt: Date.now()
            });
            localStorage.setItem('superNotes', JSON.stringify(notes));
            renderNotes();
        }
    });
});

function renderNotes() {
    const grid = document.getElementById('notesGrid');
    const empty = document.getElementById('emptyState');
    
    if (notes.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    grid.innerHTML = notes.map(note => `
        <div class="note-card" data-id="${note.id}">
            <div class="note-header"><h3>${note.title}</h3></div>
            <div class="note-footer">${new Date(note.updatedAt).toLocaleDateString('ru-RU')}</div>
        </div>
    `).join('');
    
    document.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', () => {
            alert('Заметка: ' + notes.find(n => n.id === card.dataset.id).title);
        });
    });
}
