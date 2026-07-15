'use strict';

const gacha = (function () {
  let machine = null;
  let hint = null;
  let capsule = null;

  const CAPSULE_COLORS = ['var(--accent)', 'var(--lemon)', 'var(--seiha)', 'var(--teal)', 'var(--cobalt)'];

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function init() {
    machine = document.getElementById('gacha-machine');
    hint = document.getElementById('gacha-hint');
    capsule = document.getElementById('gacha-capsule');
  }

  function spin(minMs) {
    reset();
    const color = CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)];
    capsule.style.setProperty('--capsule-color', color);
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
    const colors = ['#1e4fa3', '#f6cf3d', '#bcd6ee', '#b23a5e', '#ffffff', '#2a7d6c'];
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
