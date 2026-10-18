'use strict';
const lineup = document.querySelector('#lineup');
const size = document.querySelector('#size');
const sizeValue = document.querySelector('#size-value');
const silhouette = document.querySelector('#silhouette');
const backdropButtons = document.querySelectorAll('[data-backdrop] button, button[data-backdrop]');
function setBackdrop(value) {
  lineup.dataset.backdrop = value;
  backdropButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.backdrop === value)));
}
function setSize() {
  lineup.style.setProperty('--art-height', `${size.value}px`);
  sizeValue.value = `${size.value} px`;
}
backdropButtons.forEach(button => button.addEventListener('click', () => setBackdrop(button.dataset.backdrop)));
size.addEventListener('input', setSize);
silhouette.addEventListener('change', () => lineup.classList.toggle('silhouette', silhouette.checked));
document.querySelector('#reset').addEventListener('click', () => {
  size.value = '320';
  silhouette.checked = false;
  lineup.classList.remove('silhouette');
  setBackdrop('dark');
  setSize();
});
