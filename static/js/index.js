document.addEventListener('DOMContentLoaded', function () {
  var missed = document.querySelector('.missed-grid');
  if (missed && window.renderMathInElement) {
    renderMathInElement(missed, { delimiters: [{ left: '\\(', right: '\\)', display: false }] });
  }

  document.querySelectorAll('.toggle-button').forEach(function (toggle) {
    var body = document.getElementById(toggle.dataset.toggle);
    toggle.addEventListener('click', function () {
      var open = body.hidden;
      body.hidden = !open;
      toggle.setAttribute('aria-expanded', open);
      var label = toggle.querySelector('span');
      label.textContent = label.textContent.replace(open ? 'Show' : 'Hide', open ? 'Hide' : 'Show');
    });
  });

  var chart = document.querySelector('.bar-chart');
  if (chart) {
    var fig = chart.parentNode, tip = document.createElement('div');
    tip.className = 'chart-tip';
    fig.appendChild(tip);
    chart.querySelectorAll('.bar-group').forEach(function (g) {
      g.addEventListener('mouseenter', function () {
        chart.classList.add('has-focus');
        g.classList.add('is-focus');
      });
      g.addEventListener('mouseleave', function () {
        chart.classList.remove('has-focus');
        g.classList.remove('is-focus');
        tip.classList.remove('is-on');
      });
    });
    chart.querySelectorAll('.bar').forEach(function (bar) {
      bar.addEventListener('mouseenter', function () {
        tip.innerHTML = '<strong>' + bar.dataset.title + '</strong><br>' + bar.dataset.body;
        var b = bar.getBoundingClientRect(), f = fig.getBoundingClientRect(), half = tip.offsetWidth / 2;
        var x = Math.max(half, Math.min(f.width - half, b.left + b.width / 2 - f.left));
        tip.style.left = x + 'px';
        tip.style.top = (b.top - f.top) + 'px';
        tip.classList.add('is-on');
      });
      bar.addEventListener('mouseleave', function () { tip.classList.remove('is-on'); });
    });
  }

  var button = document.querySelector('.copy-button');
  var code = document.querySelector('.bibtex-block code');
  if (button && code) {
    var copyIcon = button.querySelector('.icon').innerHTML;
    button.addEventListener('click', function () {
      var label = button.querySelector('span:last-child');
      var icon = button.querySelector('.icon');
      navigator.clipboard.writeText(code.textContent).then(function () {
        icon.innerHTML = '<svg class="fa" viewBox="0 0 512 512" aria-hidden="true"><path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/></svg>';
        label.textContent = 'Copied';
        setTimeout(function () {
          icon.innerHTML = copyIcon;
          label.textContent = 'Copy';
        }, 1500);
      }).catch(function () {
        window.getSelection().selectAllChildren(code);
      });
    });
  }
});
