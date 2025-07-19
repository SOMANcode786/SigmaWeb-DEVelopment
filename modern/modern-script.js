// Modern JS Interactions
// Initialize AOS (Animate on Scroll)
AOS.init({
  once: true,
  duration: 800,
  easing: 'ease-out-cubic'
});

// Theme Toggle (Light/Dark)
const themeToggle = document.getElementById('themeToggle');
const rootHtml = document.documentElement;
let isDark = false;

function switchTheme() {
  isDark = !isDark;
  if (isDark) {
    rootHtml.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="bi bi-moon"></i>';
  } else {
    rootHtml.classList.remove('dark-theme');
    themeToggle.innerHTML = '<i class="bi bi-sun"></i>';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', switchTheme);
}

// Mobile Menu Toggle
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('navMenu');
if (mobileToggle && navMenu) {
  mobileToggle.addEventListener('click', () => {
    navMenu.classList.toggle('show-menu');
    mobileToggle.classList.toggle('open');
  });
}

// Ripple Effect on Buttons
function createRipple(event) {
  const button = event.currentTarget;
  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
  circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
  circle.classList.add('ripple');
  const ripple = button.getElementsByClassName('ripple')[0];
  if (ripple) {
    ripple.remove();
  }
  button.appendChild(circle);
}

const rippleButtons = document.querySelectorAll('.ripple-effect');
for (const btn of rippleButtons) {
  btn.addEventListener('click', createRipple);
}

// Play video overlay click
const playBtn = document.getElementById('playBtn');
if (playBtn) {
  const iframe = document.querySelector('.video-wrapper iframe');
  const overlay = document.querySelector('.video-overlay');
  playBtn.addEventListener('click', () => {
    if (iframe && overlay) {
      const src = iframe.getAttribute('src');
      if (!src.includes('autoplay=1')) {
        iframe.setAttribute('src', src + '?autoplay=1');
      }
      overlay.style.display = 'none';
    }
  });
}
