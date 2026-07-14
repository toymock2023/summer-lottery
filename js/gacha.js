'use strict';

const gacha = (function () {
  let machine = null;
  let hint = null;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function init() {
    machine = document.getElementById('gacha-machine');
    hint = document.getElementById('gacha-hint');
  }

  function spin(minMs) {
    reset();
    machine.classList.add('is-spinning');
    hint.textContent = '扭蛋轉動中…';
    return wait(minMs || 2500);
  }

  async function drop() {
    machine.classList.remove('is-spinning');
    machine.classList.add('is-dropping');
    hint.textContent = '扭蛋出來囉！';
    await wait(900);
    machine.classList.add('is-open');
    await wait(500);
  }

  function reset() {
    machine.classList.remove('is-spinning', 'is-dropping', 'is-open');
  }

  function confetti() {
    const colors = ['#1f93dd', '#ffd43b', '#7ec8e3', '#ef6c8f', '#ffffff', '#9fd8a3'];
    const box = document.createElement('div');
    box.className = 'confetti';
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('span');
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 0.8 + 's';
      piece.style.animationDuration = 2.2 + Math.random() * 1.6 + 's';
      box.appendChild(piece);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4500);
  }

  return { init: init, spin: spin, drop: drop, reset: reset, confetti: confetti };
})();
