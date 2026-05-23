const OS = {
  history: [], historyIdx: -1, vars: { pi: Math.PI, e: Math.E, phi: (1+Math.sqrt(5))/2, c: 299792458, h: 6.62607015e-34, G: 6.67430e-11, kB: 1.380649e-23, NA: 6.02214076e23, R: 8.314462618, eps0: 8.8541878128e-12, mu0: 1.25663706212e-6, me: 9.1093837015e-31, mp: 1.67262192369e-27, mn: 1.67492749804e-27, g: 9.80665, atm: 101325, au: 1.495978707e11, pc: 3.085677581e16, LY: 9.4607304725808e15, eV: 1.602176634e-19, alpha: 7.2973525693e-3 },
  aliases: {}, sessions: {}, startTime: Date.now(), theme: 'mono', cmdList: {},

  init() {
    const outp = document.getElementById('term-out');
    const inp = document.getElementById('input');
    if (!outp || !inp) return;
    this.outp = outp; this.inp = inp;
    this.registerAll();
    this.banner();
    this.bindKeys();
    inp.addEventListener('input', () => { this._tabSuggest = null; });
    this.loadSessions();
    this._autoScroll = true;
    this.outp.addEventListener('scroll', () => {
      this._autoScroll = this.outp.scrollHeight - this.outp.scrollTop - this.outp.clientHeight < 20;
    });
  },

  // ======================== I/O ========================
  print(text, cls) {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    this.outp.appendChild(s);
    if (this._autoScroll) this.outp.scrollTop = this.outp.scrollHeight;
  },
  println(text, cls) { this.print((text||'') + '\n', cls); },
  line(text, cls) { this.println(text, cls); },
  br() { this.println(''); },

  input() { return this.inp.value; },
  setInput(val) { this.inp.value = val; this.inp.selectionStart = this.inp.selectionEnd = val.length; },
  focus() { this.inp.focus(); },

  banner() {
    this.br();
    this.line('  ╔══════════════════════════════════════════════════════════╗', 'dim');
    this.line('  ║            MathOS  v1.0  —  Terminal Edition           ║', 'em');
    this.line('  ║     Mathematical Operating System  (cli)               ║', 'dim');
    this.line('  ╚══════════════════════════════════════════════════════════╝', 'dim');
    this.br();
    this.line('  Type  help   for command list', 'hl');
    this.line('  Type  help <cmd>  for detailed help', 'hl');
    this.line('  Type any expression to evaluate (e.g.  2 + 2,  sin(pi/4))', 'dim');
    this.br();
  },

  // ======================== KEY BINDINGS ========================
  bindKeys() {
    this.inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.process(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.histBack(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.histFwd(); }
      else if (e.key === 'Tab') { e.preventDefault(); this.autocomplete(); }
      else if (e.key === 'Escape') { this.setInput(''); this._tabSuggest = null; }
    });
    document.addEventListener('click', () => this.focus());
  },

  histBack() {
    if (this.history.length === 0) return;
    if (this.historyIdx > 0) this.historyIdx--;
    else if (this.historyIdx === -1) { this.historyIdx = this.history.length - 1; }
    this.setInput(this.history[this.historyIdx]);
  },
  histFwd() {
    if (this.historyIdx === -1 || this.historyIdx >= this.history.length - 1) { this.historyIdx = -1; this.setInput(''); return; }
    this.historyIdx++;
    this.setInput(this.history[this.historyIdx]);
  },

  _tabSuggest: null,
  autocomplete() {
    const val = this.inp.value;
    const cursor = this.inp.selectionStart;
    const before = val.slice(0, cursor);
    const words = before.split(/\s+/);
    const partial = words[words.length - 1] || '';
    if (words.length === 1 && !val.includes(' ')) {
      // Command completion
      const cmds = Object.keys(this.cmdList).filter(c => c.startsWith(partial));
      if (cmds.length === 0) return;
      if (cmds.length === 1) {
        this.setInput(cmds[0] + ' ');
      } else {
        // Find common prefix
        let prefix = cmds[0];
        for (let i = 1; i < cmds.length; i++) {
          while (cmds[i].indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
        }
        if (prefix !== partial) { this.setInput(val.slice(0, cursor - partial.length) + prefix); }
        else { // Show options
          this.println('  ' + cmds.join('  '), 'dim');
          this.prompt(val);
        }
      }
    } else {
      // Argument completion for known commands
      const firstWord = val.split(/\s+/)[0];
      const cmd = this.cmdList[firstWord];
      if (cmd && cmd.complete) cmd.complete(words, partial, val, cursor);
    }
  },

  // ======================== PROCESS INPUT ========================
  process() {
    const raw = this.inp.value;
    this.setInput('');
    this.println('  mathos> ' + raw, 'dim');
    this._tabSuggest = null;
    if (!raw.trim()) return;
    this.history.push(raw);
    this.historyIdx = this.history.length;
    this.execute(raw);
  },

  prompt(val) {
    this.println('  mathos> ' + (val || this.inp.value), 'dim');
  },

  execute(input) {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Variable assignment: name = expr
    const letMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)/);
    if (letMatch) {
      this.doLet(letMatch[1], letMatch[2]);
      return;
    }

    // Alias expansion
    let cmdLine = trimmed;
    const first = cmdLine.split(/\s+/)[0];
    if (this.aliases[first]) {
      cmdLine = this.aliases[first] + cmdLine.slice(first.length);
    }

    const tokens = this.tokenize(cmdLine);
    const cmd = tokens[0] ? tokens[0].toLowerCase() : '';
    const args = tokens.slice(1);

    if (this.cmdList[cmd]) {
      try {
        this.cmdList[cmd].fn(args);
      } catch (e) {
        this.println('  Error: ' + e.message, 'err');
      }
    } else {
      // Try as expression
      try {
        const result = this.evaluate(cmdLine);
        if (result !== null && result !== undefined && !(typeof result === 'number' && isNaN(result))) {
          this.println('  = ' + this.fmt(result), 'ok');
        } else {
          this.println('  Unknown command: ' + cmd + '   (try help)', 'err');
        }
      } catch(e) {
        this.println('  Unknown command: ' + cmd + '   (try help)', 'err');
      }
    }
  },

  // ======================== COMMAND REGISTRATION ========================
  reg(id, fn, help, opts) {
    this.cmdList[id] = { fn, help, opts: opts || {} };
  },

  registerAll() {
    // ======================== HELP ========================
    this.reg('help', args => {
      if (args.length > 0) {
        const cmd = this.cmdList[args[0]];
        if (cmd && cmd.help) {
          this.br();
          const lines = cmd.help.split('\n');
          lines.forEach((l, i) => this.line('  ' + l, i === 0 ? 'em' : ''));
          this.br();
        } else {
          this.line('  No help for "' + args[0] + '"', 'err');
        }
        return;
      }
      this.br();
      this.line('  ┌─────────────────────────────────────────────────────────┐', 'dim');
      this.line('  │  MathOS Command Reference                             │', 'em');
      this.line('  └─────────────────────────────────────────────────────────┘', 'dim');
      this.br();
      const cats = [
        ['System', 'help','clear','echo','about','date','uptime','theme','export','env','which'],
        ['Arithmetic','calc','factor','prime','primes','divisors','gcd','lcm','fib','pi','factorial','rand','sort','mod','round','clamp','lerp','percent','logb','modinv','modexp'],
        ['Number Theory','totient','ispal','isperfect','collatz','goldbach','crt','digit'],
        ['Algebra','solve','poly','matrix','rref','eigen','norm','trace','outer','project','least','pseudoinv','matrix_pow','matrix_exp','svd2','lu','qr','cholesky'],
        ['Calculus','derive','integrate','simpson','limit','newton','bisect','euler','taylor','rk4','gradient','laplace','convolve','montecarlo','hessian','jacobian','simplex'],
        ['Vectors','vector'],
        ['Complex','complex'],
        ['Fractals & Chaos','mandelbrot','julia','sierpinski','logistic','lorenz','henon','bifurcation'],
        ['Signal Processing','dft','fft','moving','conv'],
        ['Plotting','plot'],
        ['Statistics','stats','mode','percentile','outlier','regression','correlation','ttest','chi2','anova','bootstrap','confidence','hypothesis','pca','sharpe','var'],
        ['Probability','prob','poisson','geometric','exponential','weibull','cdfnorm','cdft'],
        ['Geometry','geo','ellipse','torus','polygon','shoelace','distance','line'],
        ['Trigonometry','trig'],
        ['Conversions','convert','base','roman'],
        ['Graph Theory','dijkstra','floyd','kruskal'],
        ['Sequences','seq','progression','padovan','catalan','bell','stirling','derange','fibheap'],
        ['Set Theory','setop'],
        ['Fractions','frac'],
        ['Variables','let','vars','const'],
        ['Functions','combine','interpolate'],
        ['Special Functions','erf','beta','zeta','lambertw','legendre'],
        ['Financial','blackscholes','bond','fv','pv','pmt','npv','irr'],
        ['Tables','table'],
        ['RPN','rpn'],
        ['Games','guess','quiz','ttt','hangman','hanoi','mastermind','twentyfour','mines','connect4','sudoku'],
        ['Session', 'save','load','ls','rm','history','alias','unalias'],
      ];
      cats.forEach(([cat, ...cmds]) => {
        this.line('  ' + cat + ':', 'head');
        this.line('    ' + cmds.map(c => {
          const e = this.cmdList[c];
          const short = e && e.help ? e.help.split('\n')[0] : '';
          return c + (short ? '  ' + short.replace(/^[a-z]+\s+/, '') : '');
        }).join('\n    '), '');
      });
      this.br();
      this.line('  Use:  help <command>   for detailed usage', 'hl');
      this.br();
    }, 'help [cmd]\n  Show this help or detailed help for a command.');

    // ======================== CLEAR ========================
    this.reg('clear', () => {
      this.outp.innerHTML = '';
      this.br();
    }, 'clear\n  Clear the terminal screen.');

    // ======================== ECHO ========================
    this.reg('echo', args => {
      this.line('  ' + args.join(' '));
    }, 'echo <text...>\n  Print text to the terminal.');

    // ======================== ABOUT ========================
    this.reg('about', () => {
      this.br();
      this.line('  MathOS v1.0  —  Terminal Edition', 'em');
      this.line('  Mathematical Operating System (Command Line Interface)', '');
      this.line('  Engine: JavaScript | UI: ASCII | Theme: Monochrome', 'dim');
      this.line('  ' + Object.keys(this.cmdList).length + ' commands available', 'hl');
      this.line('  Built: ' + new Date().toISOString().slice(0,10), 'dim');
      this.br();
    }, 'about\n  Show information about MathOS.');

    // ======================== DATE ========================
    this.reg('date', () => {
      const d = new Date();
      this.line('  ' + d.toLocaleString('en-US', {weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'}), '');
    }, 'date\n  Show current date and time.');

    // ======================== UPTIME ========================
    this.reg('uptime', () => {
      const sec = Math.floor((Date.now() - this.startTime) / 1000);
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      this.line('  Uptime: ' + d + 'd ' + h + 'h ' + m + 'm ' + s + 's', '');
    }, 'uptime\n  Show system uptime.');

    // ======================== THEME ========================
    this.reg('theme', args => {
      if (args.length === 0) { this.line('  Theme: ' + this.theme, ''); return; }
      const t = args[0].toLowerCase();
      if (t === 'mono') {
        this.theme = 'mono';
        document.body.style.color = '#c0c0c0';
        document.querySelector('#input').style.color = '#c0c0c0';
        document.querySelector('#input').style.caretColor = '#c0c0c0';
        document.querySelector('#term').style.background = '#000';
        this.line('  Theme set to: monochrome', 'ok');
      } else if (t === 'green') {
        this.theme = 'green';
        document.body.style.color = '#33ff33';
        document.querySelector('#input').style.color = '#33ff33';
        document.querySelector('#input').style.caretColor = '#33ff33';
        document.querySelector('#term').style.background = '#000';
        this.line('  Theme set to: green (Matrix)', 'ok');
      } else if (t === 'amber') {
        this.theme = 'amber';
        document.body.style.color = '#ffb000';
        document.querySelector('#input').style.color = '#ffb000';
        document.querySelector('#input').style.caretColor = '#ffb000';
        document.querySelector('#term').style.background = '#000';
        this.line('  Theme set to: amber', 'ok');
      } else if (t === 'white') {
        this.theme = 'white';
        document.body.style.color = '#fff';
        document.querySelector('#input').style.color = '#fff';
        document.querySelector('#input').style.caretColor = '#fff';
        document.querySelector('#term').style.background = '#000';
        this.line('  Theme set to: white', 'ok');
      } else {
        this.line('  Themes: mono, green, amber, white', 'warn');
      }
    }, 'theme <name>\n  Change color theme. Options: mono, green, amber, white.');

    // ======================== EXPORT ========================
    this.reg('export', () => {
      const text = this.outp.textContent;
      const blob = new Blob([text], {type:'text/plain'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mathos_session_' + new Date().toISOString().slice(0,19).replace(/[:-]/g,'') + '.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      this.line('  Session exported.', 'ok');
    }, 'export\n  Export terminal session as a text file.');

    // ======================== HISTORY ========================
    this.reg('history', () => {
      if (this.history.length === 0) { this.line('  No commands in history.', 'dim'); return; }
      this.br();
      this.history.forEach((h, i) => this.line('  ' + (i+1).toString().padStart(4) + '  ' + h, ''));
      this.br();
    }, 'history\n  Show command history.');

    // ======================== SAVE / LOAD ========================
    this.reg('save', args => {
      if (args.length === 0) { this.line('  Usage: save <name>', 'warn'); return; }
      const name = args[0];
      const data = { history: this.history, vars: this.vars, aliases: this.aliases, theme: this.theme };
      try {
        const all = JSON.parse(localStorage.getItem('mathos_sessions') || '{}');
        all[name] = data;
        localStorage.setItem('mathos_sessions', JSON.stringify(all));
        this.line('  Session "' + name + '" saved.', 'ok');
      } catch(e) { this.line('  Save failed: ' + e.message, 'err'); }
    }, 'save <name>\n  Save current session (history, vars, aliases) to localStorage.');

    this.reg('load', args => {
      if (args.length === 0) { this.line('  Usage: load <name>', 'warn'); return; }
      const name = args[0];
      try {
        const all = JSON.parse(localStorage.getItem('mathos_sessions') || '{}');
        if (!all[name]) { this.line('  Session "' + name + '" not found.', 'err'); return; }
        const data = all[name];
        this.history = data.history || [];
        this.historyIdx = this.history.length;
        this.vars = data.vars || {};
        this.aliases = data.aliases || {};
        if (data.theme) this.cmdList.theme.fn([data.theme]);
        this.line('  Session "' + name + '" loaded.', 'ok');
        this.line('  History: ' + this.history.length + ' commands, Vars: ' + Object.keys(this.vars).length, 'dim');
      } catch(e) { this.line('  Load failed: ' + e.message, 'err'); }
    }, 'load <name>\n  Load a saved session.');

    this.reg('ls', () => {
      try {
        const all = JSON.parse(localStorage.getItem('mathos_sessions') || '{}');
        const names = Object.keys(all);
        if (names.length === 0) { this.line('  No saved sessions.', 'dim'); return; }
        this.br();
        this.line('  Saved sessions:', 'head');
        names.forEach(n => this.line('    ' + n, ''));
        this.br();
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'ls\n  List saved sessions.');

    this.reg('rm', args => {
      if (args.length === 0) { this.line('  Usage: rm <session>', 'warn'); return; }
      try {
        const all = JSON.parse(localStorage.getItem('mathos_sessions') || '{}');
        if (!all[args[0]]) { this.line('  Session not found.', 'err'); return; }
        delete all[args[0]];
        localStorage.setItem('mathos_sessions', JSON.stringify(all));
        this.line('  Session "' + args[0] + '" deleted.', 'ok');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'rm <name>\n  Delete a saved session.');

    this.loadSessions = function() {
      // Just loads session names into memory for listing
      try { this.sessions = JSON.parse(localStorage.getItem('mathos_sessions') || '{}'); } catch(e) {}
    };

    // ======================== ALIAS ========================
    this.reg('alias', args => {
      if (args.length === 0) {
        const keys = Object.keys(this.aliases);
        if (keys.length === 0) { this.line('  No aliases defined.', 'dim'); return; }
        this.br();
        this.line('  Aliases:', 'head');
        keys.forEach(k => this.line('    ' + k + ' = ' + this.aliases[k], ''));
        this.br();
        return;
      }
      if (args.length < 2) { this.line('  Usage: alias <name> <command>', 'warn'); return; }
      this.aliases[args[0]] = args.slice(1).join(' ');
      this.line('  Alias "' + args[0] + '" set.', 'ok');
    }, 'alias [name] [command]\n  Create or list command aliases.\n  alias  ls   list\n  alias  cls  clear');

    this.reg('unalias', args => {
      if (args.length === 0) { this.line('  Usage: unalias <name>', 'warn'); return; }
      if (this.aliases[args[0]]) { delete this.aliases[args[0]]; this.line('  Alias removed.', 'ok'); }
      else { this.line('  Alias not found.', 'err'); }
    }, 'unalias <name>\n  Remove a command alias.');

    // ======================== WHICH ========================
    this.reg('which', args => {
      if (args.length === 0) { this.line('  Usage: which <command>', 'warn'); return; }
      const c = args[0];
      if (this.cmdList[c]) { this.line('  ' + c + ': built-in command', 'ok'); return; }
      if (this.aliases[c]) { this.line('  ' + c + ': aliased to "' + this.aliases[c] + '"', 'hl'); return; }
      this.line('  ' + c + ': not found', 'err');
    }, 'which <command>\n  Show whether a command is built-in or aliased.');

    // ======================== ENV ========================
    this.reg('env', () => {
      this.br();
      this.line('  Environment:', 'head');
      this.line('    Theme: ' + this.theme, '');
      this.line('    History: ' + this.history.length + ' entries', '');
      this.line('    Variables: ' + Object.keys(this.vars).length, '');
      this.line('    Aliases: ' + Object.keys(this.aliases).length, '');
      this.line('    Uptime: ' + Math.floor((Date.now()-this.startTime)/1000) + 's', '');
      this.line('    Platform: ' + navigator.platform, 'dim');
      this.line('    User Agent: ' + navigator.userAgent, 'dim');
      this.br();
    }, 'env\n  Show environment information.');

    // ======================== CALC ========================
    this.reg('calc', args => {
      const expr = args.join(' ');
      if (!expr.trim()) { this.line('  Usage: calc <expression>', 'warn'); return; }
      try {
        const result = this.evaluate(expr);
        this.line('  = ' + this.fmt(result), 'ok');
      } catch(e) {
        this.line('  Error: ' + e.message, 'err');
      }
    }, 'calc <expression>\n  Evaluate a mathematical expression.\n  Supports: + - * / ^ ( ) sin cos tan log ln sqrt abs\n  Constants: pi, e, phi, c, h, G, kB, NA, R, g, eV\n  Examples:\n    calc 2 + 3 * 4\n    calc sin(pi/4)\n    calc sqrt(2) * cos(pi/3)',
    { complete(words, partial, val, cursor) {
      // Var name completion
      const varNames = Object.keys(this.vars).filter(v => v.startsWith(partial));
      if (varNames.length > 0) {
        if (varNames.length === 1) {
          const before = val.slice(0, cursor - partial.length);
          const after = val.slice(cursor);
          this.setInput(before + varNames[0] + after);
          this.inp.selectionStart = this.inp.selectionEnd = before.length + varNames[0].length;
        } else {
          this.println('  ' + varNames.join('  '), 'dim');
          this.prompt(val);
        }
      }
    }});

    // ======================== LET ========================
    this.reg('let', args => {
      if (args.length < 3 || args[1] !== '=') { this.line('  Usage: let <name> = <expression>', 'warn'); return; }
      this.doLet(args[0], args.slice(2).join(' '));
    }, 'let <name> = <expression>\n  Assign a value to a variable.\n  Also works with:  name = expression\n  Examples:\n    let a = 5\n    x = sqrt(2) + 1\n    poly = x^2 + 3*x - 1');

    this.doLet = function(name, expr) {
      if (!/^[a-zA-Z_]\w*$/.test(name)) { this.println('  Invalid variable name: ' + name, 'err'); return; }
      try {
        const val = this.evaluate(expr);
        this.vars[name] = val;
        this.println('  ' + name + ' = ' + this.fmt(val), 'ok');
      } catch(e) {
        this.println('  Error: ' + e.message, 'err');
      }
    };

    // ======================== VARS ========================
    this.reg('vars', () => {
      const keys = Object.keys(this.vars);
      if (keys.length === 0) { this.line('  No variables defined.', 'dim'); return; }
      this.br();
      this.line('  Variables (' + keys.length + '):', 'head');
      keys.forEach(k => this.line('    ' + k + ' = ' + this.fmt(this.vars[k]), ''));
      this.br();
    }, 'vars\n  List all defined variables and their values.');

    // ======================== EVALUATION ENGINE ========================
    this.evaluate = function(expr) {
      let e = expr
        .replace(/\^/g, '**')
        .replace(/π/g, 'Math.PI')
        .replace(/Math\.Math\./g, 'Math.');
      // Replace variable names
      const varNames = Object.keys(this.vars).sort((a,b) => b.length - a.length);
      varNames.forEach(v => {
        const re = new RegExp('\\b' + v + '\\b', 'g');
        e = e.replace(re, '(' + this.vars[v] + ')');
      });
      // Replace function names with Math.*
      const funcs = ['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','log','ln','log2','log10','sqrt','cbrt','abs','ceil','floor','round','exp','sign'];
      funcs.forEach(f => {
        const re = new RegExp('\\b' + f + '\\s*\\(', 'g');
        if (f === 'ln') e = e.replace(re, 'Math.log(');
        else e = e.replace(re, 'Math.' + f + '(');
      });
      return new Function('return ' + e)();
    };

    // ======================== PI ========================
    this.reg('pi', args => {
      const n = args.length > 0 ? Math.min(parseInt(args[0]) || 10, 100) : 30;
      const p = '3.' + '1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679'.slice(0, n);
      this.line('  π = ' + p, 'ok');
      if (n >= 30) this.line('  (' + (n+1) + ' digits)', 'dim');
    }, 'pi [digits]\n  Show π to the specified number of decimal places (max 100).\n  Default: 30 digits.');

    // ======================== FACTOR ========================
    this.reg('factor', args => {
      if (args.length === 0) { this.line('  Usage: factor <n>', 'warn'); return; }
      let n = parseInt(args[0]);
      if (isNaN(n) || n < 2) { this.line('  Enter a positive integer ≥ 2.', 'warn'); return; }
      const orig = n;
      const factors = [];
      let d = 2;
      while (d * d <= n) { while (n % d === 0) { factors.push(d); n /= d; } d++; }
      if (n > 1) factors.push(n);
      const counts = {};
      factors.forEach(f => counts[f] = (counts[f] || 0) + 1);
      const str = Object.entries(counts).map(([p, e]) => p + (e > 1 ? '^' + e : '')).join(' × ');
      this.line('  ' + orig + ' = ' + str, 'ok');
    }, 'factor <n>\n  Compute prime factorization of a positive integer.\n  Example:  factor 360  ->  2^3 × 3^2 × 5');

    // ======================== PRIME ========================
    this.reg('prime', args => {
      if (args.length === 0) { this.line('  Usage: prime <n>', 'warn'); return; }
      const n = parseInt(args[0]);
      if (isNaN(n) || n < 2) { this.line('  ' + n + ' is not prime (definition: ≥ 2).', 'err'); return; }
      let isPrime = true;
      for (let i = 2; i * i <= n; i++) { if (n % i === 0) { isPrime = false; break; } }
      if (isPrime) {
        this.line('  ' + n + ' is prime.', 'ok');
      } else {
        // Find smallest divisor
        let div = 2;
        while (n % div !== 0) div++;
        this.line('  ' + n + ' is not prime. Divisible by ' + div + '.', 'err');
      }
    }, 'prime <n>\n  Test if a positive integer is prime.\n  Example:  prime 17  ->  is prime');

    // ======================== DIVISORS ========================
    this.reg('divisors', args => {
      if (args.length === 0) { this.line('  Usage: divisors <n>', 'warn'); return; }
      let n = Math.abs(parseInt(args[0]));
      if (isNaN(n) || n < 1) { this.line('  Enter a positive integer.', 'warn'); return; }
      const divs = [];
      for (let i = 1; i * i <= n; i++) { if (n % i === 0) { divs.push(i); if (i * i !== n) divs.push(n / i); } }
      divs.sort((a, b) => a - b);
      this.line('  Divisors of ' + n + ' (' + divs.length + '):', '');
      // Show in rows
      const chunks = [];
      for (let i = 0; i < divs.length; i += 10) chunks.push(divs.slice(i, i + 10).join(', '));
      chunks.forEach(c => this.line('    ' + c, ''));
    }, 'divisors <n>\n  List all positive divisors of an integer.\n  Example:  divisors 12  ->  1, 2, 3, 4, 6, 12');

    // ======================== GCD ========================
    this.reg('gcd', args => {
      if (args.length < 2) { this.line('  Usage: gcd <a> <b>', 'warn'); return; }
      let a = Math.abs(parseInt(args[0])), b = Math.abs(parseInt(args[1]));
      if (isNaN(a) || isNaN(b)) { this.line('  Enter integers.', 'err'); return; }
      const origA = a, origB = b;
      while (b) { [a, b] = [b, a % b]; }
      this.line('  GCD(' + origA + ', ' + origB + ') = ' + a, 'ok');
    }, 'gcd <a> <b>\n  Greatest common divisor using Euclidean algorithm.\n  Example:  gcd 48 36  ->  12');

    // ======================== LCM ========================
    this.reg('lcm', args => {
      if (args.length < 2) { this.line('  Usage: lcm <a> <b>', 'warn'); return; }
      let a = Math.abs(parseInt(args[0])), b = Math.abs(parseInt(args[1]));
      if (isNaN(a) || isNaN(b)) { this.line('  Enter integers.', 'err'); return; }
      const origA = a, origB = b;
      let x = a, y = b;
      while (y) { [x, y] = [y, x % y]; }
      const l = (a * b) / x;
      this.line('  LCM(' + origA + ', ' + origB + ') = ' + l, 'ok');
    }, 'lcm <a> <b>\n  Least common multiple.\n  Example:  lcm 12 18  ->  36');

    // ======================== FIB ========================
    this.reg('fib', args => {
      if (args.length === 0) { this.line('  Usage: fib <n> [start]', 'warn'); return; }
      const n = Math.min(100, Math.max(1, parseInt(args[0]) || 1));
      const start = args.length > 1 ? parseInt(args[1]) || 0 : 0;
      const seq = [0, 1];
      for (let i = 2; i <= n + start; i++) seq.push(seq[i-1] + seq[i-2]);
      const show = seq.slice(start, start + n);
      this.line('  Fibonacci (' + start + ' to ' + (start + n - 1) + '):', '');
      // Format in rows
      const chunks = [];
      for (let i = 0; i < show.length; i += 8) {
        chunks.push(show.slice(i, i+8).map((v, j) => {
          const idx = start + i + j;
          return 'F_' + idx + '=' + v;
        }).join('  '));
      }
      chunks.forEach(c => this.line('    ' + c, ''));
    }, 'fib <n> [offset]\n  Generate Fibonacci sequence.\n  Example:  fib 10  ->  F_0 to F_9');

    // ======================== TRIG ========================
    this.reg('trig', args => {
      if (args.length === 0) { this.line('  Usage: trig <angle> [deg|rad]', 'warn'); return; }
      const angle = parseFloat(args[0]);
      if (isNaN(angle)) { this.line('  Invalid angle.', 'err'); return; }
      const isDeg = args.length > 1 && args[1].toLowerCase().startsWith('d');
      const rad = isDeg ? angle * Math.PI / 180 : angle;
      const sinV = Math.sin(rad), cosV = Math.cos(rad), tanV = Math.tan(rad);
      const cscV = 1 / sinV, secV = 1 / cosV, cotV = 1 / tanV;
      const unit = isDeg ? 'deg' : 'rad';
      this.br();
      this.line('  Trig functions of ' + angle + ' ' + unit + ' (' + (rad).toFixed(6) + ' rad):', 'head');
      this.line('    sin = ' + this.fmt(sinV), '');
      this.line('    cos = ' + this.fmt(cosV), '');
      this.line('    tan = ' + this.fmt(tanV), '');
      this.line('    csc = ' + this.fmt(cscV), 'dim');
      this.line('    sec = ' + this.fmt(secV), 'dim');
      this.line('    cot = ' + this.fmt(cotV), 'dim');
      this.br();
    }, 'trig <angle> [deg|rad]\n  Compute all six trigonometric functions.\n  Default unit is radians. Use "deg" for degrees.\n  Example:  trig 45 deg   or   trig 1.5708');

    // ======================== SOLVE ========================
    this.reg('solve', args => {
      if (args.length === 0) { this.line('  Usage: solve <type> <params>', 'warn'); this.line('  Types: linear, quadratic, system', 'dim'); return; }
      const type = args[0].toLowerCase();
      const rest = args.slice(1).map(parseFloat);
      if (type === 'linear') {
        if (rest.length < 2) { this.line('  Usage: solve linear <a> <b>  (ax + b = 0)', 'warn'); return; }
        const [a, b] = rest;
        if (a === 0) { this.line('  ' + (b === 0 ? 'Infinite solutions (0 = 0)' : 'No solution'), 'warn'); return; }
        const x = -b / a;
        this.br();
        this.line('  ' + a + 'x + ' + b + ' = 0', '');
        this.line('  x = ' + this.fmt(x), 'ok');
        this.br();
      } else if (type === 'quadratic') {
        if (rest.length < 3) { this.line('  Usage: solve quadratic <a> <b> <c>  (ax² + bx + c = 0)', 'warn'); return; }
        const [a, b, c] = rest;
        if (a === 0) { this.line('  Not quadratic (a = 0). Use solve linear.', 'warn'); return; }
        const disc = b*b - 4*a*c;
        const den = 2*a;
        this.br();
        this.line('  ' + a + 'x² + ' + b + 'x + ' + c + ' = 0', '');
        this.line('  Discriminant: Δ = ' + this.fmt(disc), 'dim');
        if (disc > 0) {
          const x1 = (-b + Math.sqrt(disc)) / den;
          const x2 = (-b - Math.sqrt(disc)) / den;
          this.line('  x₁ = ' + this.fmt(x1), 'ok');
          this.line('  x₂ = ' + this.fmt(x2), 'ok');
        } else if (disc === 0) {
          const x = -b / den;
          this.line('  x = ' + this.fmt(x) + ' (double root)', 'ok');
        } else {
          const re = (-b / den);
          const im = Math.sqrt(-disc) / den;
          this.line('  x₁ = ' + this.fmt(re) + ' + ' + this.fmt(im) + 'i', 'ok');
          this.line('  x₂ = ' + this.fmt(re) + ' - ' + this.fmt(im) + 'i', 'ok');
        }
        this.br();
      } else if (type === 'system') {
        if (rest.length < 6) { this.line('  Usage: solve system <a1> <b1> <c1> <a2> <b2> <c2>', 'warn'); this.line('  Solves: a1*x + b1*y = c1, a2*x + b2*y = c2', 'dim'); return; }
        const [a1,b1,c1,a2,b2,c2] = rest;
        const det = a1*b2 - a2*b1;
        this.br();
        this.line('  ' + a1 + 'x + ' + b1 + 'y = ' + c1, '');
        this.line('  ' + a2 + 'x + ' + b2 + 'y = ' + c2, '');
        if (det === 0) { this.line('  No unique solution (det = 0).', 'err'); return; }
        const x = (c1*b2 - c2*b1) / det;
        const y = (a1*c2 - a2*c1) / det;
        this.line('  det = ' + this.fmt(det), 'dim');
        this.line('  x = ' + this.fmt(x), 'ok');
        this.line('  y = ' + this.fmt(y), 'ok');
        this.br();
      } else {
        this.line('  Unknown type: ' + type + '. Types: linear, quadratic, system', 'err');
      }
    }, 'solve <type> <params>\n  Solve equations.\n  Types:\n    linear <a> <b>        ax + b = 0\n    quadratic <a> <b> <c>  ax² + bx + c = 0\n    system <a1> <b1> <c1> <a2> <b2> <c2>\n                           a1x + b1y = c1\n                           a2x + b2y = c2');

    // ======================== POLY ========================
    this.reg('poly', args => {
      if (args.length < 2) { this.line('  Usage: poly <op> <args>', 'warn'); return; }
      const op = args[0].toLowerCase();
      const rest = args.slice(1);
      const parsePoly = (str) => {
        const terms = str.replace(/\s/g,'').match(/[+-]?[^+-]+/g) || [];
        const coeffs = {};
        terms.forEach(t => {
          let coeff = 1, exp = 0;
          if (t.includes('x')) {
            const parts = t.split('x');
            const c = parts[0];
            coeff = c === '' || c === '+' ? 1 : c === '-' ? -1 : parseFloat(c);
            const e = parts[1] || '';
            exp = e.startsWith('^') ? parseInt(e.slice(1))||1 : e.includes('²') ? 2 : e.includes('³') ? 3 : 1;
          } else { coeff = parseFloat(t) || 0; }
          coeffs[exp] = (coeffs[exp] || 0) + coeff;
        });
        const md = Math.max(...Object.keys(coeffs).map(Number), 0);
        return Array.from({length:md+1}, (_,i) => coeffs[i] || 0);
      };
      const formatPoly = (c) => {
        const terms = [];
        for (let i = c.length-1; i >= 0; i--) {
          if (c[i] === 0) continue;
          const s = terms.length === 0 ? (c[i] < 0 ? '-' : '') : (c[i] < 0 ? ' − ' : ' + ');
          const a = Math.abs(c[i]);
          if (i === 0) terms.push(s + a);
          else if (i === 1) terms.push(s + (a === 1 ? '' : a) + 'x');
          else terms.push(s + (a === 1 ? '' : a) + 'x^' + i);
        }
        return terms.join('') || '0';
      };
      if (op === 'eval') {
        if (rest.length < 2) { this.line('  Usage: poly eval <polynomial> <x>', 'warn'); return; }
        const p = parsePoly(rest.slice(0, -1).join(' '));
        const x = parseFloat(rest[rest.length-1]);
        let val = 0;
        p.forEach((c, i) => val += c * Math.pow(x, i));
        this.line('  P(' + x + ') = ' + this.fmt(val), 'ok');
      } else if (['add','sub','mul'].includes(op)) {
        if (rest.length < 2) { this.line('  Usage: poly ' + op + ' <poly1> <poly2>', 'warn'); return; }
        // Find the two polynomials by splitting on the last occurrence of 'x'
        // Simple approach: treat all but last arg as second poly
        // Actually, use a heuristic: split args in half
        const mid = Math.ceil(rest.length / 2);
        const p1 = parsePoly(rest.slice(0, mid).join(' '));
        const p2 = parsePoly(rest.slice(mid).join(' '));
        const maxLen = Math.max(p1.length, p2.length);
        let result;
        if (op === 'add') result = Array.from({length:maxLen}, (_,i)=> (p1[i]||0)+(p2[i]||0));
        else if (op === 'sub') result = Array.from({length:maxLen}, (_,i)=> (p1[i]||0)-(p2[i]||0));
        else {
          result = Array(p1.length + p2.length - 1).fill(0);
          p1.forEach((av,ai) => p2.forEach((bv,bi) => result[ai+bi] += av*bv));
        }
        this.line('  Result: ' + formatPoly(result), 'ok');
        this.line('  Degree: ' + (result.length-1) + '  Coefficients: [' + result.map(v=>this.fmt(v)).join(', ') + ']', 'dim');
      } else {
        this.line('  Operations: add, sub, mul, eval', 'warn');
      }
    }, 'poly <op> <args>\n  Polynomial operations.\n  Operations:\n    add <p1> <p2>    P + Q\n    sub <p1> <p2>    P - Q\n    mul <p1> <p2>    P × Q\n    eval <p> <x>     P(x)\n  Example:  poly add x^2+1 2x-3');

    // ======================== MATRIX ========================
    this.reg('matrix', args => {
      if (args.length < 1) { this.line('  Usage: matrix <op> [data]', 'warn');
        this.line('  Operations: add, sub, mul, det, inv, trans', 'dim');
        this.line('  Format matrices as: [[a,b],[c,d]]', 'dim');
        return; }
      const op = args[0].toLowerCase();
      const parseMat = (s) => {
        s = s.replace(/;/g, '],[');
        try {
          const m = JSON.parse(s);
          return Array.isArray(m) ? m : null;
        } catch(e) { return null; }
      };
      const fmtMat = (m) => {
        if (!m || !m.length) return '[]';
        const colW = m[0].map((_,ci) => Math.max(...m.map(row => this.fmt(row[ci]).length)));
        return m.map(row => '  | ' + row.map((v,i) => this.fmt(v).padStart(colW[i])).join('  ') + ' |').join('\n');
      };
      const readArgs = () => {
        // Read matrix from rest of args
        const str = args.slice(1).join(' ');
        // Find matrix parts: [[...]]
        const matches = str.match(/\[\[.*?\]\]/g);
        if (!matches) return null;
        return matches.map(m => parseMat(m));
      };
      if (op === 'det') {
        const mat = parseMat(args.slice(1).join(' '));
        if (!mat || mat.length !== mat[0].length) { this.line('  Invalid square matrix.', 'err'); return; }
        const det = this.detMatrix(mat);
        this.line('  det = ' + this.fmt(det), 'ok');
      } else if (op === 'inv') {
        const mat = parseMat(args.slice(1).join(' '));
        if (!mat || mat.length !== mat[0].length) { this.line('  Invalid square matrix.', 'err'); return; }
        try {
          const inv = this.invMatrix(mat);
          this.line('  A⁻¹ =');
          this.line(fmtMat(inv), '');
        } catch(e) { this.line('  ' + e.message, 'err'); }
      } else if (op === 'trans' || op === 'transpose') {
        const mat = parseMat(args.slice(1).join(' '));
        if (!mat) { this.line('  Invalid matrix.', 'err'); return; }
        const t = mat[0].map((_,c) => mat.map(r => r[c]));
        this.line('  Aᵀ =');
        this.line(fmtMat(t), '');
      } else if (['add','sub','mul'].includes(op)) {
        const mats = readArgs();
        if (!mats || mats.length < 2) { this.line('  Need two matrices.', 'err'); return; }
        const [A, B] = mats;
        let result;
        if (op === 'add') result = A.map((r,i) => r.map((v,j) => v + (B[i]||[])[j] || 0));
        else if (op === 'sub') result = A.map((r,i) => r.map((v,j) => v - (B[i]||[])[j] || 0));
        else {
          const n = A[0].length, m = B.length, p = B[0].length;
          if (n !== m) { this.line('  A cols ≠ B rows.', 'err'); return; }
          result = Array.from({length:A.length}, () => Array(p).fill(0));
          for (let i = 0; i < A.length; i++)
            for (let j = 0; j < p; j++)
              for (let k = 0; k < n; k++)
                result[i][j] += A[i][k] * B[k][j];
        }
        this.line('  Result =');
        this.line(fmtMat(result), 'ok');
      } else {
        this.line('  Unknown operation: ' + op, 'err');
      }
    }, 'matrix <op> <matrix>\n  Matrix operations.\n  Format: [[a,b],[c,d]] or [a,b;c,d]\n  Operations:\n    det [[1,2],[3,4]]        determinant\n    inv [[1,2],[3,4]]        inverse\n    trans [[1,2],[3,4]]      transpose\n    add [[a,b],[c,d]] [[e,f],[g,h]]\n    sub [[a,b],[c,d]] [[e,f],[g,h]]\n    mul [[a,b],[c,d]] [[e,f],[g,h]]');

    // ======================== DERIVE ========================
    this.reg('derive', args => {
      if (args.length < 2) { this.line('  Usage: derive <function> <x>', 'warn'); return; }
      const fnStr = args.slice(0, -1).join(' ');
      const x = parseFloat(args[args.length-1]);
      if (isNaN(x)) { this.line('  Invalid x value.', 'err'); return; }
      const h = 1e-8;
      try {
        const f = new Function('x', 'return ' + fnStr.replace(/\^/g, '**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        const f1 = f(x + h), f2 = f(x - h);
        if (!isFinite(f1) || !isFinite(f2)) { this.line('  Function undefined near x = ' + x, 'err'); return; }
        const deriv = (f1 - f2) / (2 * h);
        this.line('  f(x) = ' + fnStr, '');
        this.line("  f'(" + x + ") = " + this.fmt(deriv), 'ok');
        this.line('  (numerical derivative, h = ' + h + ')', 'dim');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'derive <function> <x>\n  Numerical derivative at a point.\n  Example:  derive sin(x) 0   ->  cos(0) ≈ 1\n  Example:  derive x^2 3     ->  6');

    // ======================== INTEGRATE ========================
    this.reg('integrate', args => {
      if (args.length < 3) { this.line('  Usage: integrate <function> <a> <b>', 'warn'); return; }
      const fnStr = args.slice(0, -2).join(' ');
      const a = parseFloat(args[args.length-2]), b = parseFloat(args[args.length-1]);
      if (isNaN(a) || isNaN(b)) { this.line('  Invalid bounds.', 'err'); return; }
      try {
        const f = new Function('x', 'return ' + fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        const n = 10000;
        const h = (b - a) / n;
        let sum = 0;
        for (let i = 0; i < n; i++) { const x = a + (i + 0.5) * h; const v = f(x); if (isFinite(v)) sum += v; }
        const result = sum * h;
        this.line('  ∫[' + a + ', ' + b + '] f(x) dx ≈ ' + this.fmt(result), 'ok');
        this.line('  (midpoint rule, ' + n + ' subintervals)', 'dim');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'integrate <function> <a> <b>\n  Numerical definite integral.\n  Example:  integrate sin(x) 0 3.14159   ->  ~2\n  Example:  integrate x^2 0 1           ->  ~0.3333');

    // ======================== LIMIT ========================
    this.reg('limit', args => {
      if (args.length < 2) { this.line('  Usage: limit <function> <x>', 'warn'); return; }
      const fnStr = args.slice(0, -1).join(' ');
      const target = parseFloat(args[args.length-1]);
      if (isNaN(target)) { this.line('  Invalid target.', 'err'); return; }
      try {
        const f = new Function('x', 'return ' + fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        this.line('  f(x) = ' + fnStr + ',  x → ' + target, '');
        const steps = [1e-2, 1e-4, 1e-6, 1e-8, 1e-10];
        const results = steps.map(h => {
          const left = f(target - h), right = f(target + h);
          return { h, left, right };
        });
        results.forEach(r => {
          const l = isFinite(r.left) ? this.fmt(r.left) : '∞';
          const ri = isFinite(r.right) ? this.fmt(r.right) : '∞';
          this.line('    h=' + r.h.toExponential(0) + '  f(x-h)=' + l + '  f(x+h)=' + ri, 'dim');
        });
        this.line('  (Approaching from both sides)', 'dim');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'limit <function> <x>\n  Approximate limit of a function.\n  Example:  limit sin(x)/x 0   ->  ~1');

    // ======================== PLOT ========================
    this.reg('plot', args => {
      if (args.length < 3) { this.line('  Usage: plot <function> <xmin> <xmax>', 'warn'); return; }
      const fnStr = args[0];
      const xmin = parseFloat(args[1]), xmax = parseFloat(args[2]);
      if (isNaN(xmin) || isNaN(xmax) || xmin >= xmax) { this.line('  Invalid range.', 'err'); return; }
      const W = 68, H = 20;
      try {
        const f = new Function('x', 'return ' + fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        const pts = [];
        let ymin = Infinity, ymax = -Infinity;
        for (let i = 0; i <= W; i++) {
          const x = xmin + (xmax - xmin) * i / W;
          let y;
          try { y = f(x); if (!isFinite(y)) y = null; } catch(e) { y = null; }
          pts.push(y);
          if (y !== null) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
        }
        if (ymin === Infinity || ymax === -Infinity) { this.line('  No valid points.', 'err'); return; }
        if (ymin === ymax) { ymin -= 1; ymax += 1; }
        const range = ymax - ymin;
        this.br();
        this.line('  ' + fnStr + '  in [' + xmin + ', ' + xmax + ']', 'em');
        this.line('  y ∈ [' + this.fmt(ymin) + ', ' + this.fmt(ymax) + ']', 'dim');
        this.br();
        for (let row = 0; row <= H; row++) {
          const yval = ymax - range * row / H;
          let line = '';
          if (row === 0) line += this.fmt(ymax, 6);
          else if (row === H) line += this.fmt(ymin, 6);
          else line += '      ';
          if (row === Math.round(H * (ymax) / range)) line += '─┤';
          else if (row === Math.round(H * (ymax - 0) / range)) line += ' ┤';
          else line += '  │';
          for (let col = 0; col <= W; col++) {
            const y = pts[col];
            if (y === null) { line += ' '; continue; }
            const yRow = H - Math.round((y - ymin) / range * H);
            if (yRow === row) {
              // Determine character based on neighbors
              const prevY = col > 0 ? pts[col-1] : null;
              const nextY = col < W ? pts[col+1] : null;
              if (prevY !== null && nextY !== null) {
                const prevRow = H - Math.round((prevY - ymin) / range * H);
                const nextRow = H - Math.round((nextY - ymin) / range * H);
                if (prevRow < row && nextRow < row) line += '╮';
                else if (prevRow > row && nextRow > row) line += '╰';
                else if (prevRow < row && nextRow > row) line += '╯';
                else if (prevRow > row && nextRow < row) line += '╭';
                else if (prevRow === row && nextRow === row) line += '─';
                else if (prevRow < row) line += '╯';
                else if (prevRow > row) line += '╰';
                else if (nextRow < row) line += '╮';
                else if (nextRow > row) line += '╭';
                else line += '·';
              } else line += '·';
            } else line += ' ';
          }
          this.line(line, '');
        }
        // X axis labels
        let xLabel = '       ';
        for (let col = 0; col <= W; col += 10) {
          const x = xmin + (xmax - xmin) * col / W;
          const label = this.fmt(x, 5);
          xLabel += label.padEnd(11, ' ');
        }
        this.line(xLabel, 'dim');
        this.br();
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'plot <function> <xmin> <xmax>\n  ASCII function plotter.\n  Example:  plot sin(x) 0 6.2831\n  Example:  plot x^2 -10 10');

    // ======================== STATS ========================
    this.reg('stats', args => {
      if (args.length === 0) { this.line('  Usage: stats <numbers...>', 'warn'); return; }
      const nums = args.map(parseFloat).filter(n => isFinite(n));
      if (nums.length < 2) { this.line('  Need at least 2 numbers.', 'warn'); return; }
      nums.sort((a,b) => a-b);
      const n = nums.length;
      const sum = nums.reduce((a,b) => a+b, 0);
      const mean = sum / n;
      const median = n%2===0 ? (nums[n/2-1]+nums[n/2])/2 : nums[Math.floor(n/2)];
      const range = nums[n-1] - nums[0];
      const variance = nums.reduce((s,v) => s + (v-mean)**2, 0) / n;
      const stdDev = Math.sqrt(variance);
      const q1 = nums[Math.floor(n/4)];
      const q3 = nums[Math.floor(3*n/4)];
      const iqr = q3 - q1;
      this.br();
      this.line('  Descriptive Statistics (n=' + n + '):', 'head');
      this.line('    Mean:     ' + this.fmt(mean), '');
      this.line('    Median:   ' + this.fmt(median), '');
      this.line('    Std Dev:  ' + this.fmt(stdDev), '');
      this.line('    Variance: ' + this.fmt(variance), 'dim');
      this.line('    Range:    ' + this.fmt(range), '');
      this.line('    Min:      ' + this.fmt(nums[0]), '');
      this.line('    Max:      ' + this.fmt(nums[n-1]), '');
      this.line('    Q1:       ' + this.fmt(q1), 'dim');
      this.line('    Q3:       ' + this.fmt(q3), 'dim');
      this.line('    IQR:      ' + this.fmt(iqr), 'dim');
      this.line('    Sum:      ' + this.fmt(sum), '');
      this.line('    SS:       ' + this.fmt(nums.reduce((s,v)=>s+v*v,0)), 'dim');
      this.br();
    }, 'stats <numbers...>\n  Compute descriptive statistics.\n  Example:  stats 5 7 8 3 10 12 6 9 11 4');

    // ======================== PROB ========================
    this.reg('prob', args => {
      if (args.length < 1) { this.line('  Usage: prob <type> <args>', 'warn');
        this.line('  Types: perm, comb, binom, norm', 'dim'); return; }
      const type = args[0].toLowerCase();
      const rest = args.slice(1).map(parseFloat);
      const fact = (n) => { if (n < 2) return 1; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
      if (type === 'perm') {
        if (rest.length < 2) { this.line('  Usage: prob perm <n> <k>', 'warn'); return; }
        const [n, k] = rest;
        const r = fact(n) / fact(n - k);
        this.line('  P(' + n + ', ' + k + ') = ' + r.toLocaleString(), 'ok');
        this.line('  Permutations: n! / (n-k)!', 'dim');
      } else if (type === 'comb') {
        if (rest.length < 2) { this.line('  Usage: prob comb <n> <k>', 'warn'); return; }
        const [n, k] = rest;
        const r = fact(n) / (fact(k) * fact(n - k));
        this.line('  C(' + n + ', ' + k + ') = ' + r.toLocaleString(), 'ok');
        this.line('  Combinations: n! / (k! × (n-k)!)', 'dim');
      } else if (type === 'binom') {
        if (rest.length < 3) { this.line('  Usage: prob binom <n> <p> <k>', 'warn'); return; }
        const [n, p, k] = rest;
        const c = fact(n) / (fact(k) * fact(n - k));
        const prob = c * Math.pow(p, k) * Math.pow(1-p, n-k);
        this.line('  P(X=' + k + ') = ' + this.fmt(prob), 'ok');
        this.line('  Binomial(n=' + n + ', p=' + p + ')', 'dim');
        if (n <= 20) {
          // Show full distribution
          this.line('  Full distribution:', 'dim');
          let line = '';
          for (let i = 0; i <= n; i++) {
            const ci = fact(n) / (fact(i) * fact(n-i));
            const pi = ci * Math.pow(p, i) * Math.pow(1-p, n-i);
            line += 'k=' + i + ':' + this.fmt(pi, 4) + '  ';
            if (i % 5 === 4) { this.line('    ' + line, 'dim'); line = ''; }
          }
          if (line) this.line('    ' + line, 'dim');
        }
      } else if (type === 'norm') {
        if (rest.length < 3) { this.line('  Usage: prob norm <x> <mu> <sigma>', 'warn'); return; }
        const [x, mu, sigma] = rest;
        const z = (x - mu) / sigma;
        const pdf = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
        this.line('  f(' + x + ') = ' + this.fmt(pdf), 'ok');
        this.line('  z-score = ' + this.fmt(z), 'dim');
        this.line('  Normal(μ=' + mu + ', σ=' + sigma + ')', 'dim');
      } else {
        this.line('  Types: perm, comb, binom, norm', 'warn');
      }
    }, 'prob <type> <args>\n  Probability calculations.\n  Types:\n    perm <n> <k>        permutations\n    comb <n> <k>        combinations\n    binom <n> <p> <k>    binomial probability\n    norm <x> <mu> <sigma>  normal PDF\n  Example:  prob comb 10 3');

    // ======================== GEO ========================
    this.reg('geo', args => {
      if (args.length < 1) { this.line('  Usage: geo <shape> <params>', 'warn');
        this.line('  Shapes: circle, triangle, rect, sphere, cube, cyl, cone', 'dim'); return; }
      const shape = args[0].toLowerCase();
      const vals = args.slice(1).map(parseFloat);
      const line = (l, r) => { if (r !== null) this.line('    ' + l + ': ' + this.fmt(r), ''); };
      if (shape === 'circle') {
        if (vals.length < 1) { this.line('  Usage: geo circle <radius>', 'warn'); return; }
        const r = vals[0];
        line('Radius', r);
        line('Area', Math.PI * r * r);
        line('Circumference', 2 * Math.PI * r);
        line('Diameter', 2 * r);
      } else if (shape === 'triangle') {
        if (vals.length < 2) { this.line('  Usage: geo triangle <base> <height>', 'warn'); return; }
        const [b, h] = vals;
        line('Base', b);
        line('Height', h);
        line('Area', 0.5 * b * h);
      } else if (shape === 'rect' || shape === 'rectangle') {
        if (vals.length < 2) { this.line('  Usage: geo rect <width> <height>', 'warn'); return; }
        const [w, h] = vals;
        line('Width', w);
        line('Height', h);
        line('Area', w * h);
        line('Perimeter', 2 * (w + h));
        line('Diagonal', Math.sqrt(w*w + h*h));
      } else if (shape === 'sphere') {
        if (vals.length < 1) { this.line('  Usage: geo sphere <radius>', 'warn'); return; }
        const r = vals[0];
        line('Radius', r);
        line('Surface Area', 4 * Math.PI * r * r);
        line('Volume', 4/3 * Math.PI * r * r * r);
      } else if (shape === 'cube') {
        if (vals.length < 1) { this.line('  Usage: geo cube <side>', 'warn'); return; }
        const s = vals[0];
        line('Side', s);
        line('Surface Area', 6 * s * s);
        line('Volume', s * s * s);
        line('Space Diagonal', s * Math.sqrt(3));
      } else if (shape === 'cyl' || shape === 'cylinder') {
        if (vals.length < 2) { this.line('  Usage: geo cyl <radius> <height>', 'warn'); return; }
        const [r, h] = vals;
        line('Radius', r);
        line('Height', h);
        line('Surface Area', 2 * Math.PI * r * (r + h));
        line('Volume', Math.PI * r * r * h);
      } else if (shape === 'cone') {
        if (vals.length < 2) { this.line('  Usage: geo cone <radius> <height>', 'warn'); return; }
        const [r, h] = vals;
        const slant = Math.sqrt(r*r + h*h);
        line('Radius', r);
        line('Height', h);
        line('Slant Height', slant);
        line('Surface Area', Math.PI * r * (r + slant));
        line('Volume', Math.PI * r * r * h / 3);
      } else {
        this.line('  Shapes: circle, triangle, rect, sphere, cube, cyl, cone', 'warn');
      }
    }, 'geo <shape> <params>\n  Geometric calculations.\n  Shapes:\n    circle <r>\n    triangle <base> <height>\n    rect <w> <h>\n    sphere <r>\n    cube <s>\n    cyl <r> <h>\n    cone <r> <h>');

    // ======================== CONVERT ========================
    this.reg('convert', args => {
      // Define units
      const units = {
        length: { m:1, km:1000, cm:.01, mm:.001, mi:1609.344, yd:.9144, ft:.3048, in:.0254, nm:1852 },
        mass: { kg:1, g:.001, mg:1e-6, t:1000, lb:.453592, oz:.0283495, st:6.35029 },
        time: { s:1, ms:.001, min:60, h:3600, d:86400, wk:604800 },
        volume: { L:.001, mL:1e-6, m3:1, gal:.00378541, qt:.000946353, pt:.000473176, cup:.000236588, floz:2.9574e-5 },
        speed: { mps:1, kmph:.277778, mph:.44704, kn:.514444, fps:.3048 },
        area: { m2:1, km2:1e6, ha:10000, acre:4046.86, ft2:.092903 },
        pressure: { Pa:1, kPa:1000, bar:100000, atm:101325, mmHg:133.322, psi:6894.76 },
        energy: { J:1, kJ:1000, cal:4.184, kcal:4184, Wh:3600, kWh:3.6e6, eV:1.602e-19 },
        power: { W:1, kW:1000, hp:745.7 },
        digital: { B:1, KB:1024, MB:1048576, GB:1073741824, TB:1099511627776, b:.125 },
      };
      if (args.length === 0) { this.line('  Usage: convert <value> <from> <to>  or  convert list [category]', 'warn'); return; }
      if (args[0] === 'list') {
        const cat = args[1] ? args[1].toLowerCase() : null;
        if (cat && units[cat]) {
          this.line('  ' + cat + ' units:', 'head');
          Object.keys(units[cat]).forEach(u => this.line('    ' + u, ''));
        } else if (cat) {
          this.line('  Categories: ' + Object.keys(units).join(', '), 'warn');
        } else {
          this.br();
          this.line('  Available unit categories:', 'head');
          Object.keys(units).forEach(c => this.line('    ' + c + ': ' + Object.keys(units[c]).join(', '), ''));
          this.br();
        }
        return;
      }
      if (args.length < 3) { this.line('  Usage: convert <value> <from> <to>', 'warn'); return; }
      const val = parseFloat(args[0]);
      const from = args[1].toLowerCase();
      const to = args[2].toLowerCase();
      if (isNaN(val)) { this.line('  Invalid value.', 'err'); return; }
      // Find category containing from and to
      let cat = null;
      for (const [c, u] of Object.entries(units)) {
        if (u[from] !== undefined && u[to] !== undefined) { cat = c; break; }
      }
      if (!cat) { this.line('  Units not found in same category.', 'err'); return; }
      const base = val * (units[cat][from] || 1);
      const result = base / (units[cat][to] || 1);
      this.line('  ' + val + ' ' + from + ' = ' + this.fmt(result) + ' ' + to, 'ok');
    }, 'convert <value> <from> <to>\n  Unit conversion.\n  Categories: length, mass, time, volume, speed, area, pressure, energy, power, digital\n  Use "convert list" to see all units.\n  Example:  convert 100 km mi\n  Example:  convert 1 kg lb');

    // ======================== BASE ========================
    this.reg('base', args => {
      if (args.length < 3) { this.line('  Usage: base <value> <fromBase> <toBase>', 'warn'); return; }
      const val = args[0];
      const fromBase = parseInt(args[1]);
      const toBase = parseInt(args[2]);
      if (isNaN(fromBase) || isNaN(toBase) || fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) {
        this.line('  Bases must be between 2 and 36.', 'err'); return;
      }
      const dec = parseInt(val, fromBase);
      if (isNaN(dec)) { this.line('  Invalid value for base ' + fromBase, 'err'); return; }
      const result = dec.toString(toBase).toUpperCase();
      this.line('  ' + val + '_' + fromBase + ' = ' + result + '_' + toBase + '  (decimal: ' + dec + ')', 'ok');
    }, 'base <value> <fromBase> <toBase>\n  Convert between number bases (2-36).\n  Example:  base FF 16 2\n  Example:  base 1010 2 10');

    // ======================== SEQ ========================
    this.reg('seq', args => {
      if (args.length < 1) { this.line('  Usage: seq <type> [params]', 'warn');
        this.line('  Types: arithmetic, geometric, fib, square, tri', 'dim'); return; }
      const type = args[0].toLowerCase();
      const rest = args.slice(1).map(parseFloat);
      const n = Math.min(50, Math.max(1, (rest.find(v => Number.isInteger(v) && v > 0)) || 10));
      const doSeq = (seq) => {
        this.line('  Sequence (' + n + ' terms):', '');
        const chunks = [];
        for (let i = 0; i < seq.length; i += 10) chunks.push(seq.slice(i, i+10).map(v => typeof v === 'number' && Number.isInteger(v) ? v : this.fmt(v)).join(', '));
        chunks.forEach(c => this.line('    ' + c, ''));
      };
      if (type === 'arithmetic' || type === 'art') {
        const a1 = rest[0] || 1, d = rest[1] || 2;
        const seq = Array.from({length:n}, (_,i) => a1 + i * d);
        doSeq(seq);
        this.line('  Sum (S_' + n + ') = ' + this.fmt(n/2 * (2*a1 + (n-1)*d)), 'dim');
      } else if (type === 'geometric' || type === 'geo') {
        const a1 = rest[0] || 1, r = rest[1] || 2;
        const seq = Array.from({length:n}, (_,i) => a1 * Math.pow(r, i));
        doSeq(seq);
        if (r !== 1) this.line('  Sum (S_' + n + ') = ' + this.fmt(a1 * (1 - Math.pow(r, n)) / (1 - r)), 'dim');
      } else if (type === 'fib' || type === 'fibonacci') {
        const a = [0, 1];
        for (let i = 2; i < n; i++) a.push(a[i-1] + a[i-2]);
        doSeq(a.slice(0, n));
        this.line('  Sum (S_' + n + ') = ' + this.fmt(a.slice(0, n).reduce((x,y)=>x+y,0)), 'dim');
      } else if (type === 'square' || type === 'sq') {
        const seq = Array.from({length:n}, (_,i) => (i+1)*(i+1));
        doSeq(seq);
        this.line('  Sum (S_' + n + ') = ' + this.fmt(n*(n+1)*(2*n+1)/6), 'dim');
      } else if (type === 'tri' || type === 'triangular') {
        const seq = Array.from({length:n}, (_,i) => (i+1)*(i+2)/2);
        doSeq(seq);
        this.line('  Sum (S_' + n + ') = ' + this.fmt(n*(n+1)*(n+2)/6), 'dim');
      } else {
        this.line('  Types: arithmetic, geometric, fib, square, tri', 'warn');
      }
    }, 'seq <type> [params]\n  Generate sequences.\n  Types:\n    arithmetic <a1> <d>\n    geometric <a1> <r>\n    fib\n    square\n    tri\n  Example:  seq arithmetic 1 2  (1, 3, 5, 7, ...)');

    // ======================== FRAC ========================
    this.reg('frac', args => {
      if (args.length < 3) {
        if (args.length === 2 && args[0] === 'dec') {
          // decimal to fraction
          const dec = parseFloat(args[1]);
          if (isNaN(dec)) { this.line('  Usage: frac dec <decimal>', 'warn'); return; }
          let n = Math.round(dec * 1e12), d = 1e12;
          const g = this.gcd(Math.abs(n), d);
          n /= g; d /= g;
          this.line('  ' + dec + ' = ' + n + '/' + d + '  =  ' + (n/d).toFixed(12), 'ok');
          return;
        }
        this.line('  Usage: frac <n1>/<d1> <op> <n2>/<d2>', 'warn');
        this.line('  Usage: frac dec <decimal>', 'warn');
        this.line('  Operations: + - * /', 'dim');
        return; }
      if (args[0] === 'dec') {
        // handled above, shouldn't reach here
        return;
      }
      const parseFrac = (s) => {
        const parts = s.split('/');
        return [parseInt(parts[0]) || 0, parts.length > 1 ? parseInt(parts[1]) || 1 : 1];
      };
      const [n1, d1] = parseFrac(args[0]);
      const op = args[1];
      const [n2, d2] = parseFrac(args[2]);
      if (!['+','-','*','/'].includes(op)) { this.line('  Operations: + - * /', 'warn'); return; }
      let rn, rd;
      if (op === '+') { rn = n1*d2 + n2*d1; rd = d1*d2; }
      else if (op === '-') { rn = n1*d2 - n2*d1; rd = d1*d2; }
      else if (op === '*') { rn = n1*n2; rd = d1*d2; }
      else { rn = n1*d2; rd = d1*n2; }
      const g = this.gcd(Math.abs(rn), Math.abs(rd));
      rn /= g; rd /= g;
      if (rd < 0) { rn = -rn; rd = -rd; }
      this.line('  ' + args[0] + ' ' + op + ' ' + args[2] + ' = ' + rn + '/' + rd + (rd !== 1 ? '  =  ' + this.fmt(rn/rd) : ''), 'ok');
    }, 'frac <n1>/<d1> <op> <n2>/<d2>\n  Fraction arithmetic.\n  Operations: +, -, *, /\n  Example:  frac 1/2 + 2/3\n  Example:  frac dec 0.75');

    // ======================== CONST (built-in) ========================
    this.reg('const', args => {
      if (args.length > 0) {
        const name = args[0].toLowerCase();
        if (this.vars[name] !== undefined) {
          this.line('  ' + name + ' = ' + this.fmt(this.vars[name]), 'ok');
          return;
        }
        this.line('  Unknown constant. Use "const" to list all.', 'err');
        return;
      }
      this.br();
      this.line('  Mathematical & Physical Constants:', 'head');
      const special = ['pi','e','phi','c','h','G','kB','NA','R','eps0','mu0','me','mp','mn','g','atm','au','pc','LY','eV','alpha'];
      special.forEach(k => {
        if (this.vars[k] !== undefined) {
          const v = this.vars[k];
          const str = typeof v === 'number' ? (v > 1e6 || v < 1e-4 ? v.toExponential(8) : v.toPrecision(10)) : String(v);
          this.line('    ' + k.padEnd(6) + ' = ' + str, '');
        }
      });
      this.br();
    }, 'const [name]\n  Show mathematical and physical constants.\n  Use "const <name>" to show a specific constant.');

    // ======================== TABLE ========================
    this.reg('table', args => {
      if (args.length === 0) { this.line('  Usage: table <type>', 'warn'); this.line('  Types: multiply, squares, trig', 'dim'); return; }
      const type = args[0].toLowerCase();
      if (type === 'multiply' || type === 'mult' || type === 'times') {
        this.br();
        this.line('  Multiplication Table (12 × 12):', 'head');
        this.br();
        let h = '     ';
        for (let c = 1; c <= 12; c++) h += c.toString().padStart(4);
        this.line(h, '');
        this.line('  ' + '─'.repeat(52), 'dim');
        for (let r = 1; r <= 12; r++) {
          let row = r.toString().padStart(2) + ' │';
          for (let c = 1; c <= 12; c++) row += (r * c).toString().padStart(4);
          this.line('  ' + row, '');
        }
        this.br();
      } else if (type === 'squares' || type === 'sq') {
        this.br();
        this.line('  Squares, Cubes, Square Roots (1-20):', 'head');
        this.br();
        this.line('    n   n²    n³    √n     ∛n', '');
        this.line('  ' + '─'.repeat(35), 'dim');
        for (let n = 1; n <= 20; n++) {
          this.line('  ' + n.toString().padStart(3) + ' ' + (n*n).toString().padStart(5) + ' ' + (n*n*n).toString().padStart(6) + ' ' + Math.sqrt(n).toFixed(4).padStart(6) + ' ' + Math.cbrt(n).toFixed(4).padStart(6), '');
        }
        this.br();
      } else if (type === 'trig') {
        this.br();
        this.line('  Trigonometric Values (common angles):', 'head');
        this.br();
        this.line('    deg    rad       sin      cos      tan', '');
        this.line('  ' + '─'.repeat(47), 'dim');
        const angles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
        angles.forEach(deg => {
          const r = deg * Math.PI / 180;
          this.line('  ' + deg.toString().padStart(3) + '° ' + r.toFixed(4).padStart(7) + ' ' + Math.sin(r).toFixed(5).padStart(7) + ' ' + Math.cos(r).toFixed(5).padStart(7) + ' ' + (Math.cos(r) === 0 ? '∞    ' : Math.tan(r).toFixed(5).padStart(7)), '');
        });
        this.br();
      } else {
        this.line('  Types: multiply, squares, trig', 'warn');
      }
    }, 'table <type>\n  Display mathematical tables.\n  Types: multiply (times table), squares, trig (common angles).');

    // ======================== REGRESSION ========================
    this.reg('regression', args => {
      if (args.length < 4) { this.line('  Usage: regression <x1,y1> <x2,y2> ...', 'warn'); this.line('  Format: x,y', 'dim'); return; }
      const pts = []; const parseP = (a) => { const m = a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/); if (m) pts.push([parseFloat(m[1]),parseFloat(m[2])]); };
      args.forEach(a => parseP(a));
      if (pts.length < 2) { this.line('  Need at least 2 points.', 'warn'); return; }
      const n = pts.length; let sx=0,sy=0,sxx=0,sxy=0;
      pts.forEach(([x,y]) => { sx+=x; sy+=y; sxx+=x*x; sxy+=x*y; });
      const slope = (n*sxy - sx*sy) / (n*sxx - sx*sx);
      const inter = (sy - slope*sx) / n;
      const yMean = sy/n;
      const ssRes = pts.reduce((s,[x,y]) => s + (y-(slope*x+inter))**2, 0);
      const ssTot = pts.reduce((s,[_,y]) => s + (y-yMean)**2, 0);
      this.br();
      this.line('  Linear Regression: y = ' + this.fmt(slope) + 'x + ' + this.fmt(inter), 'ok');
      this.line('  n = ' + n + '  |  R' + String.fromCharCode(0x00B2) + ' = ' + this.fmt(1-ssRes/ssTot) + '  |  R = ' + this.fmt(Math.sqrt(1-ssRes/ssTot)*(slope>=0?1:-1)), '');
      this.line('  Predictions:', 'dim');
      pts.forEach(([x,y]) => { const p = slope*x+inter; this.line('    x=' + this.fmt(x) + '  y=' + this.fmt(y) + '  pred=' + this.fmt(p) + '  resid=' + this.fmt(y-p), 'dim'); });
      this.br();
    }, 'regression <points...>\n  Linear regression (least squares).\n  Format each point as x,y.\n  Example:  regression 1,2 2,4 3,5 4,6');

    // ======================== CORRELATION ========================
    this.reg('correlation', args => {
      if (args.length < 4) { this.line('  Usage: correlation <x1,y1> <x2,y2> ...', 'warn'); return; }
      const pts = []; args.forEach(a => { const m = a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/); if (m) pts.push([parseFloat(m[1]),parseFloat(m[2])]); });
      if (pts.length < 2) { this.line('  Need at least 2 points.', 'warn'); return; }
      const n = pts.length; let sx=0,sy=0,sxx=0,syy=0,sxy=0;
      pts.forEach(([x,y]) => { sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y; });
      const r = (n*sxy-sx*sy) / Math.sqrt((n*sxx-sx*sx)*(n*syy-sy*sy));
      this.br();
      this.line('  Pearson Correlation:', 'head');
      this.line('    r = ' + this.fmt(r), 'ok');
      this.line('    r' + String.fromCharCode(0x00B2) + ' = ' + this.fmt(r*r), '');
      const st = Math.abs(r)>=0.8?'very strong':Math.abs(r)>=0.6?'strong':Math.abs(r)>=0.4?'moderate':Math.abs(r)>=0.2?'weak':'very weak';
      this.line('    ' + st + ' ' + (r>=0?'positive':'negative') + ' (n=' + n + ')', 'dim');
      this.line('    Cov(x,y) = ' + this.fmt(sxy/n-(sx/n)*(sy/n)), 'dim');
      this.br();
    }, 'correlation <points...>\n  Pearson correlation coefficient.\n  Example:  correlation 1,2 2,4 3,5 4,7');

    // ======================== NEWTON ========================
    this.reg('newton', args => {
      if (args.length < 2) { this.line('  Usage: newton <fn> <guess> [maxIter]', 'warn'); return; }
      const fnStr = args.slice(0,-1).join(' '); let guess = parseFloat(args[args.length-1]);
      const maxIter = Math.min(100, parseInt(args[2])||20);
      if (isNaN(guess)) { this.line('  Invalid guess.', 'err'); return; }
      try {
        const f = new Function('x','return '+fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        this.line('  Newton-Raphson: f(x) = ' + fnStr, '');
        this.line('  Initial guess: ' + guess, 'dim'); this.br();
        let iter;
        for (iter = 0; iter < maxIter; iter++) {
          const fx = f(guess); const h = 1e-8;
          const fpx = (f(guess+h)-f(guess-h))/(2*h);
          if (Math.abs(fpx) < 1e-15) { this.line('  Derivative near zero.', 'warn'); break; }
          const next = guess - fx/fpx;
          this.line('    ' + (iter+1) + ': x=' + this.fmt(guess) + '  f(x)=' + this.fmt(fx), 'dim');
          if (Math.abs(next-guess) < 1e-12) { guess = next; break; }
          guess = next;
        }
        this.br(); this.line('  Root: x ' + String.fromCharCode(0x2248) + ' ' + this.fmt(guess), 'ok');
        this.line('  f(x) = ' + this.fmt(f(guess)) + '  |  ' + (iter+1) + ' iterations', 'dim');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'newton <fn> <guess> [maxIter]\n  Newton-Raphson root finding.\n  Example:  newton x^2-2 1.5   (finds sqrt(2))');

    // ======================== BISECT ========================
    this.reg('bisect', args => {
      if (args.length < 3) { this.line('  Usage: bisect <fn> <a> <b> [maxIter]', 'warn'); return; }
      const fnStr = args.slice(0,-2).join(' '); let a = parseFloat(args[args.length-2]), b = parseFloat(args[args.length-1]);
      const maxIter = Math.min(100, parseInt(args[2])||50);
      if (isNaN(a)||isNaN(b)||a>=b) { this.line('  Invalid interval.', 'err'); return; }
      try {
        const f = new Function('x','return '+fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        let fa = f(a), fb = f(b);
        if (fa*fb >= 0) { this.line('  f(a) and f(b) must have opposite signs.', 'err'); return; }
        this.line('  Bisection: f(x) = ' + fnStr + '  on [' + a + ', ' + b + ']', '');
        this.line('  f(a)=' + this.fmt(fa) + '  f(b)=' + this.fmt(fb), 'dim'); this.br();
        let iter, c;
        for (iter = 0; iter < maxIter; iter++) {
          c = (a+b)/2; const fc = f(c);
          this.line('    ' + (iter+1) + ': [' + this.fmt(a) + ', ' + this.fmt(b) + ']  c=' + this.fmt(c) + '  f(c)=' + this.fmt(fc), 'dim');
          if (Math.abs(fc) < 1e-14 || (b-a)/2 < 1e-14) break;
          if (fa*fc < 0) { b=c; fb=fc; } else { a=c; fa=fc; }
        }
        this.br(); this.line('  Root: x ' + String.fromCharCode(0x2248) + ' ' + this.fmt(c), 'ok');
        this.line('  f(x) = ' + this.fmt(f(c)) + '  |  ' + (iter+1) + ' iterations', 'dim');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'bisect <fn> <a> <b> [maxIter]\n  Bisection method. f(a) and f(b) must have opposite signs.\n  Example:  bisect x^2-2 1 2');

    // ======================== EULER ========================
    this.reg('euler', args => {
      if (args.length < 5) { this.line('  Usage: euler <fn> <x0> <y0> <x1> <n>', 'warn'); this.line('  Solves: dy/dx = f(x,y)', 'dim'); return; }
      const fnStr = args[0]; const x0=parseFloat(args[1]), y0=parseFloat(args[2]), x1=parseFloat(args[3]), n=parseInt(args[4]);
      if (isNaN(x0)||isNaN(y0)||isNaN(x1)||isNaN(n)||n<1) { this.line('  Invalid.', 'err'); return; }
      try {
        const f = new Function('x','y','return '+fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        const h = (x1-x0)/n; let x=x0, y=y0;
        this.line('  Euler: dy/dx = ' + fnStr + ',  y(' + x0 + ') = ' + y0, '');
        this.line('  x' + String.fromCharCode(0x2081) + ' = ' + x1 + ',  n = ' + n + ',  h = ' + this.fmt(h), 'dim'); this.br();
        for (let i = 1; i <= n; i++) { y += h*f(x,y); x = x0+i*h; if (i<=3||i===n||i%Math.max(1,Math.floor(n/5))===0) this.line('    Step ' + i + ': x=' + this.fmt(x) + '  y=' + this.fmt(y), 'dim'); }
        this.br(); this.line('  y(' + x1 + ') ' + String.fromCharCode(0x2248) + ' ' + this.fmt(y), 'ok');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'euler <fn> <x0> <y0> <x1> <n>\n  Eulers method for ODEs: dy/dx = f(x,y).\n  Example:  euler y 0 1 2 10');

    // ======================== SIMPSON ========================
    this.reg('simpson', args => {
      if (args.length < 3) { this.line('  Usage: simpson <fn> <a> <b> [n]', 'warn'); return; }
      const fnStr = args.slice(0,-2).join(' '); const a=parseFloat(args[args.length-2]), b=parseFloat(args[args.length-1]);
      const n = Math.max(2, Math.min(1000, parseInt(args[2])||100));
      if (isNaN(a)||isNaN(b)) { this.line('  Invalid bounds.', 'err'); return; }
      if (n%2!==0) { this.line('  n must be even.', 'warn'); return; }
      try {
        const f = new Function('x','return '+fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        const h = (b-a)/n; let sum = f(a)+f(b);
        for (let i=1;i<n;i++) sum += (i%2===0?2:4)*f(a+i*h);
        const r = sum*h/3;
        this.line('  Simpson(' + fnStr + ', ' + a + ', ' + b + ') ' + String.fromCharCode(0x2248) + ' ' + this.fmt(r), 'ok');
        this.line('  (Simpson 1/3 rule, n=' + n + ')', 'dim');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'simpson <fn> <a> <b> [n]\n  Simpsons 1/3 rule (n must be even).\n  More accurate than basic integrate.\n  Example:  simpson x^2 0 1');

    // ======================== TAYLOR ========================
    this.reg('taylor', args => {
      if (args.length < 3) { this.line('  Usage: taylor <fn> <a> <n>', 'warn'); return; }
      const fnStr = args.slice(0,-2).join(' '); const a=parseFloat(args[args.length-2]); const n=Math.min(10,Math.max(1,parseInt(args[args.length-1])||4));
      if (isNaN(a)||isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      try {
        const f = new Function('x','return '+fnStr.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/log/g,'Math.log10').replace(/ln/g,'Math.log').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/exp/g,'Math.exp'));
        this.line('  Taylor series of ' + fnStr + ' around x=' + a + ' (n=' + n + '):', 'em'); this.br();
        const der = (o,pt) => { const h=1e-6; if(o===0)return f(pt); if(o===1)return (f(pt+h)-f(pt-h))/(2*h); if(o===2)return (f(pt+h)-2*f(pt)+f(pt-h))/(h*h); return 0; };
        for (let k=0;k<=n;k++) {
          const d = der(k,a); if (Math.abs(d)<1e-12) continue;
          let fac=1;for(let fi=2;fi<=k;fi++)fac*=fi;const t_term=d/fac;
          const xpart = k===0?'':k===1?'(x-'+a+')':'(x-'+a+')^'+k;
          this.line('    ' + (k===0?'  ':' + ') + this.fmt(t_term) + xpart + '    [f^(' + k + ')(' + a + ')=' + this.fmt(d) + ']', '');
        }
        this.br();
        this.line('  P_' + n + '(x) = ' + String.fromCharCode(0x03A3) + ' f^(k)(' + a + ')/k! ' + String.fromCharCode(0x00B7) + ' (x-' + a + ')^k', 'dim');
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'taylor <fn> <a> <n>\n  Taylor series expansion (numerical derivatives).\n  Example:  taylor sin(x) 0 6');

    // ======================== VECTOR ========================
    this.reg('vector', args => {
      if (args.length < 3) { this.line('  Usage: vector <op> <v1> <v2>', 'warn'); this.line('  Ops: add sub dot cross mag angle unit', 'dim'); return; }
      const op = args[0].toLowerCase();
      const pV = (s) => { const m=s.match(/\[?([\d.-]+)\s*,?\s*([\d.-]+)\s*,?\s*([\d.-]+)?\]?/); if(!m)return null; const r=[parseFloat(m[1]),parseFloat(m[2])]; if(m[3]!==undefined)r.push(parseFloat(m[3])); return r; };
      const v1 = pV(args[1]), v2 = pV(args[2]);
      if(!v1||!v2) { this.line('  Format: 1,2,3 or [1,2,3]', 'err'); return; }
      const dim=Math.max(v1.length,v2.length); const pad=(v)=>{while(v.length<dim)v.push(0);return v;};
      const a=pad([...v1]),b=pad([...v2]); const vs=(v)=>'('+v.map(x=>this.fmt(x)).join(', ')+')';
      if(op==='add') this.line('  ' + vs(a)+' + '+vs(b)+' = '+vs(a.map((x,i)=>x+b[i])), 'ok');
      else if(op==='sub') this.line('  ' + vs(a)+' - '+vs(b)+' = '+vs(a.map((x,i)=>x-b[i])), 'ok');
      else if(op==='dot') this.line('  ' + vs(a)+' . '+vs(b)+' = '+this.fmt(a.reduce((s,x,i)=>s+x*b[i],0)), 'ok');
      else if(op==='cross') { if(dim<3){this.line('  Cross needs 3D.', 'warn');return;} const r=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; this.line('  '+vs(a)+' x '+vs(b)+' = '+vs(r), 'ok'); }
      else if(op==='mag') this.line('  |' + vs(a) + '| = ' + this.fmt(Math.sqrt(a.reduce((s,x)=>s+x*x,0))) + '  |' + vs(b) + '| = ' + this.fmt(Math.sqrt(b.reduce((s,x)=>s+x*x,0))), '');
      else if(op==='angle') { const dot=a.reduce((s,x,i)=>s+x*b[i],0); const ma=Math.sqrt(a.reduce((s,x)=>s+x*x,0)), mb=Math.sqrt(b.reduce((s,x)=>s+x*x,0)); const ang=Math.acos(Math.max(-1,Math.min(1,dot/(ma*mb)))); this.line('  Angle = ' + this.fmt(ang) + ' rad = ' + this.fmt(ang*180/Math.PI) + String.fromCharCode(0x00B0), 'ok'); }
      else if(op==='unit') { const ma=Math.sqrt(a.reduce((s,x)=>s+x*x,0)), mb=Math.sqrt(b.reduce((s,x)=>s+x*x,0)); if(ma===0||mb===0){this.line('  Zero vector.', 'err');return;} this.line('  u' + String.fromCharCode(0x2081) + ' = ' + vs(a.map(x=>x/ma)), ''); this.line('  u' + String.fromCharCode(0x2082) + ' = ' + vs(b.map(x=>x/mb)), ''); }
      else this.line('  Ops: add sub dot cross mag angle unit', 'warn');
    }, 'vector <op> <v1> <v2>\n  Vector operations (2D or 3D).\n  Ops: add sub dot cross mag angle unit\n  Example:  vector dot 1,2,3 4,5,6');

    // ======================== COMPLEX ========================
    this.reg('complex', args => {
      if (args.length < 3) { this.line('  Usage: complex <op> <z1> [z2]', 'warn'); this.line('  Ops: add sub mul div conj mag arg pow', 'dim'); return; }
      const op = args[0].toLowerCase(); const pC = (s) => { s=s.replace(/\s/g,''); const m=s.match(/^([\d.-]+)\s*([+-])\s*([\d.-]+)i$/); if(m)return[parseFloat(m[1]),parseFloat(m[2]==='+'?1:-1)*parseFloat(m[3])]; const m2=s.match(/^([\d.-]+)i$/); if(m2)return[0,parseFloat(m2[1])]; const m3=s.match(/^([\d.-]+)$/); if(m3)return[parseFloat(m3[1]),0]; const parts=s.split(','); if(parts.length>=2)return[parseFloat(parts[0]),parseFloat(parts[1])]; return null; };
      const fC = (c) => { if(Math.abs(c[1])<1e-15)return this.fmt(c[0]); if(Math.abs(c[0])<1e-15)return this.fmt(c[1])+'i'; return this.fmt(c[0])+(c[1]<0?' - ':' + ')+this.fmt(Math.abs(c[1]))+'i'; };
      const z1 = pC(args[1]), z2 = pC(args[2]);
      if(!z1||!z2) { this.line('  Format: a+bi or a,b', 'err'); return; }
      if(op==='add') this.line('  ' + fC(z1) + ' + ' + fC(z2) + ' = ' + fC([z1[0]+z2[0],z1[1]+z2[1]]), 'ok');
      else if(op==='sub') this.line('  ' + fC(z1) + ' - ' + fC(z2) + ' = ' + fC([z1[0]-z2[0],z1[1]-z2[1]]), 'ok');
      else if(op==='mul') this.line('  ' + fC(z1) + ' x ' + fC(z2) + ' = ' + fC([z1[0]*z2[0]-z1[1]*z2[1],z1[0]*z2[1]+z1[1]*z2[0]]), 'ok');
      else if(op==='div') { const den=z2[0]*z2[0]+z2[1]*z2[1]; if(den===0){this.line('  Div by zero.', 'err');return;} this.line('  ' + fC(z1) + ' / ' + fC(z2) + ' = ' + fC([(z1[0]*z2[0]+z1[1]*z2[1])/den,(z1[1]*z2[0]-z1[0]*z2[1])/den]), 'ok'); }
      else if(op==='conj') this.line('  conj(' + fC(z1) + ') = ' + fC([z1[0],-z1[1]]), '');
      else if(op==='mag') this.line('  |' + fC(z1) + '| = ' + this.fmt(Math.sqrt(z1[0]*z1[0]+z1[1]*z1[1])), 'ok');
      else if(op==='arg') this.line('  arg(' + fC(z1) + ') = ' + this.fmt(Math.atan2(z1[1],z1[0])) + ' rad = ' + this.fmt(Math.atan2(z1[1],z1[0])*180/Math.PI) + String.fromCharCode(0x00B0), 'ok');
      else if(op==='pow') { const p = Math.round(z2[0]); let r=[1,0]; for(let i=0;i<Math.abs(p);i++) r=[r[0]*z1[0]-r[1]*z1[1],r[0]*z1[1]+r[1]*z1[0]]; if(p<0){const d=r[0]*r[0]+r[1]*r[1];r=d?[r[0]/d,-r[1]/d]:[0,0];} this.line('  ' + fC(z1) + '^' + p + ' = ' + fC(r), 'ok'); }
      else this.line('  Ops: add sub mul div conj mag arg pow', 'warn');
    }, 'complex <op> <z1> [z2]\n  Complex number operations.\n  Ops: add sub mul div conj mag arg pow\n  Example:  complex mul 3+4i 1-2i');

    // ======================== RAND ========================
    this.reg('rand', args => {
      if (args.length === 0) { this.line('  Usage: rand <type> [params]', 'warn'); this.line('  Types: int, float, normal, coin, dice', 'dim'); return; }
      const type = args[0].toLowerCase();
      if (type === 'int') { const min=parseInt(args[1])||0, max=parseInt(args[2])||100; this.line('  ' + (Math.floor(Math.random()*(max-min+1))+min), 'ok'); }
      else if (type === 'float') { const min=parseFloat(args[1])||0, max=parseFloat(args[2])||1; this.line('  ' + this.fmt(Math.random()*(max-min)+min), 'ok'); }
      else if (type === 'normal') { const mu=parseFloat(args[1])||0, sigma=parseFloat(args[2])||1; let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); this.line('  ' + this.fmt(mu+sigma*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)), 'ok'); }
      else if (type === 'coin') this.line('  ' + (Math.random()<0.5?'Heads':'Tails'), '');
      else if (type === 'dice') { const sides=parseInt(args[1])||6; this.line('  ' + (Math.floor(Math.random()*sides)+1), 'ok'); }
      else this.line('  Types: int, float, normal, coin, dice', 'warn');
    }, 'rand <type> [params]\n  Random numbers.\n  int <min> <max> | float [min] [max]\n  normal <mu> <sigma> | coin | dice [sides]');

    // ======================== PRIMES ========================
    this.reg('primes', args => {
      const limit = Math.min(10000, Math.max(2, parseInt(args[0])||100));
      const sieve = new Array(limit+1).fill(true); sieve[0]=sieve[1]=false;
      for(let i=2;i*i<=limit;i++) if(sieve[i]) for(let j=i*i;j<=limit;j+=i) sieve[j]=false;
      const primes = []; for(let i=2;i<=limit;i++) if(sieve[i]) primes.push(i);
      this.line('  Primes up to ' + limit + ' (' + primes.length + '):', 'head');
      const chunks = []; for(let i=0;i<primes.length;i+=15) chunks.push(primes.slice(i,i+15).join(' '));
      chunks.forEach(c => this.line('  ' + c, ''));
      this.line('  ' + String.fromCharCode(0x03C0) + '(' + limit + ') = ' + primes.length, 'dim');
    }, 'primes <limit>\n  Generate primes using Sieve of Eratosthenes.\n  Example:  primes 50  ->  2 3 5 7 11 13 17 19 23 29 31 37 41 43 47');

    // ======================== ROMAN ========================
    this.reg('roman', args => {
      if (args.length === 0) { this.line('  Usage: roman <n>  or  roman <numeral>', 'warn'); return; }
      const toR = (n) => { if(n<1||n>3999)return 'Out of range (1-3999)'; const v=[1000,900,500,400,100,90,50,40,10,9,5,4,1], c=['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']; let r=''; v.forEach((x,i)=>{while(n>=x){r+=c[i];n-=x}}); return r; };
      const fromR = (s) => { const m={I:1,V:5,X:10,L:50,C:100,D:500,M:1000}; let t=0; s=s.toUpperCase(); for(let i=0;i<s.length;i++){const c=m[s[i]]||0, n=m[s[i+1]]||0; t+=c<n?-c:c} return t||NaN; };
      const val = parseInt(args[0]);
      if (!isNaN(val) && val > 0) this.line('  ' + val + ' = ' + toR(val), 'ok');
      else { const d = fromR(args[0]); if(!isNaN(d)&&d>0) this.line('  ' + args[0].toUpperCase() + ' = ' + d, 'ok'); else this.line('  Invalid. Use 1-3999 or Roman numeral.', 'err'); }
    }, 'roman <n|numeral>\n  Convert integers to/from Roman numerals (1-3999).\n  Example:  roman 2024   roman MMXXIV');

    // ======================== SORT ========================
    this.reg('sort', args => {
      if (args.length === 0) { this.line('  Usage: sort <numbers...>', 'warn'); return; }
      const nums = args.map(parseFloat).filter(n => isFinite(n));
      if (nums.length === 0) { this.line('  No valid numbers.', 'err'); return; }
      nums.sort((a,b)=>a-b);
      this.line('  Sorted (' + nums.length + '):', '');
      const chunks = []; for(let i=0;i<nums.length;i+=15) chunks.push(nums.slice(i,i+15).map(v=>this.fmt(v)).join(', '));
      chunks.forEach(c => this.line('    ' + c, ''));
      this.line('  Min: ' + this.fmt(nums[0]) + '  Max: ' + this.fmt(nums[nums.length-1]) + '  Range: ' + this.fmt(nums[nums.length-1]-nums[0]), 'dim');
    }, 'sort <numbers...>\n  Sort numbers in ascending order.\n  Example:  sort 9 3 7 1 5');

    // ======================== MODE ========================
    this.reg('mode', args => {
      if (args.length === 0) { this.line('  Usage: mode <numbers...>', 'warn'); return; }
      const nums = args.map(parseFloat).filter(n => isFinite(n));
      if (nums.length === 0) { this.line('  No numbers.', 'err'); return; }
      const freq = {}; nums.forEach(v => freq[v]=(freq[v]||0)+1);
      const max = Math.max(...Object.values(freq));
      const modes = Object.entries(freq).filter(([_,c])=>c===max).map(([v])=>v);
      this.line('  Mode: ' + modes.join(', ') + '  (frequency: ' + max + ')', 'ok');
      this.line('  Frequencies:', 'dim');
      Object.entries(freq).sort(([a],[b])=>parseFloat(b)-parseFloat(a)).forEach(([v,c])=> { this.line('    ' + this.fmt(parseFloat(v)) + ': ' + String.fromCharCode(0x2588).repeat(Math.min(20,c*20/max)) + ' ' + c, 'dim'); });
    }, 'mode <numbers...>\n  Find the mode(s) with frequency bar chart.\n  Example:  mode 1 2 2 3 3 3 4');

    // ======================== PERCENTILE ========================
    this.reg('percentile', args => {
      if (args.length < 2) { this.line('  Usage: percentile <numbers...> <p>', 'warn'); return; }
      const p = parseFloat(args[args.length-1]); if(isNaN(p)||p<0||p>100){this.line('  p must be 0-100.', 'warn');return;}
      const nums = args.slice(0,-1).map(parseFloat).filter(n=>isFinite(n)); if(nums.length<2){this.line('  Need >=2 numbers.', 'warn');return;}
      nums.sort((a,b)=>a-b); const n=nums.length; const idx=(p/100)*(n-1); const lo=Math.floor(idx), hi=Math.ceil(idx);
      const val = idx%1===0 ? nums[idx] : nums[lo]+(nums[hi]-nums[lo])*(idx-lo);
      this.line('  P' + p + ' = ' + this.fmt(val), 'ok'); this.line('  (n='+n+', rank='+this.fmt(idx)+')', 'dim');
    }, 'percentile <numbers...> <p>\n  Compute the p-th percentile.\n  Example:  percentile 1 2 3 4 5 6 7 8 9 10 50');

    // ======================== OUTLIER ========================
    this.reg('outlier', args => {
      if (args.length < 4) { this.line('  Usage: outlier <numbers...>', 'warn'); return; }
      const nums = args.map(parseFloat).filter(n=>isFinite(n)); if(nums.length<4){this.line('  Need >=4 numbers.', 'warn');return;}
      nums.sort((a,b)=>a-b); const q1=nums[Math.floor(nums.length/4)], q3=nums[Math.floor(3*nums.length/4)]; const iqr=q3-q1;
      const low=q1-1.5*iqr, up=q3+1.5*iqr; const out=nums.filter(v=>v<low||v>up);
      this.br(); this.line('  Outlier Detection (IQR method):', 'head');
      this.line('    Q1 = ' + this.fmt(q1) + '  Q3 = ' + this.fmt(q3) + '  IQR = ' + this.fmt(iqr), '');
      this.line('    Fences: [' + this.fmt(low) + ', ' + this.fmt(up) + ']', 'dim');
      if(out.length===0) this.line('    No outliers.', 'ok');
      else this.line('    Outliers ('+out.length+'): ' + out.map(v=>this.fmt(v)).join(', '), 'warn');
      this.br();
    }, 'outlier <numbers...>\n  Detect outliers using IQR (Tukey) method.\n  Example:  outlier 1 2 3 4 5 100');

    // ======================== PROGRESSION ========================
    this.reg('progression', args => {
      if (args.length < 3) { this.line('  Usage: progression <type> <a1> <d/r> [n]', 'warn'); this.line('  Types: art (arithmetic), geo (geometric)', 'dim'); return; }
      const type = args[0].toLowerCase(); const a1=parseFloat(args[1]), d=parseFloat(args[2]); const n=Math.min(50,parseInt(args[3])||10);
      if(isNaN(a1)||isNaN(d)||isNaN(n)){this.line('  Invalid.', 'err');return;}
      if(type==='art'||type==='arithmetic') {
        const seq=Array.from({length:n},(_,i)=>a1+i*d); const sum=n/2*(2*a1+(n-1)*d);
        this.line('  Arithmetic Progression:', 'em'); this.line('    a' + String.fromCharCode(0x2081) + '='+this.fmt(a1)+'  d='+this.fmt(d)+'  n='+n, '');
        this.line('    a_n='+this.fmt(a1+(n-1)*d), 'ok'); this.line('    S_n='+this.fmt(sum), 'ok');
        this.line('    ' + seq.map(v=>this.fmt(v)).join(', '), 'dim');
      } else if(type==='geo'||type==='geometric') {
        const seq=Array.from({length:n},(_,i)=>a1*Math.pow(d,i)); const sum=d===1?a1*n:a1*(1-Math.pow(d,n))/(1-d);
        this.line('  Geometric Progression:', 'em'); this.line('    a' + String.fromCharCode(0x2081) + '='+this.fmt(a1)+'  r='+this.fmt(d)+'  n='+n, '');
        this.line('    a_n='+this.fmt(a1*Math.pow(d,n-1)), 'ok'); this.line('    S_n='+this.fmt(sum), 'ok');
        if(Math.abs(d)<1) this.line('    S_inf = ' + this.fmt(a1/(1-d)) + '  (convergent)', 'dim');
        this.line('    ' + seq.map(v=>this.fmt(v)).join(', '), 'dim');
      } else this.line('  Types: art, geo', 'warn');
    }, 'progression <type> <a1> <d/r> [n]\n  Arithmetic/geometric progressions.\n  Example:  progression art 1 2 10');

    // ======================== CONFIDENCE ========================
    this.reg('confidence', args => {
      if (args.length < 3) { this.line('  Usage: confidence <mean> <sigma> <n> [level]', 'warn'); this.line('  level: 90, 95 (default), 99', 'dim'); return; }
      const mean=parseFloat(args[0]), sigma=parseFloat(args[1]), n=parseInt(args[2]); const level=parseInt(args[3])||95;
      if(isNaN(mean)||isNaN(sigma)||isNaN(n)||n<1){this.line('  Invalid.', 'err');return;}
      const z=level===90?1.645:level===95?1.96:level===99?2.576:1.96; const se=sigma/Math.sqrt(n); const margin=z*se;
      this.br(); this.line('  Confidence Interval (' + level + '%):', 'head');
      this.line('    Mean: ' + this.fmt(mean) + '  SE: ' + this.fmt(se), '');
      this.line('    Margin: ' + this.fmt(margin), 'dim');
      this.line('    CI: [' + this.fmt(mean-margin) + ', ' + this.fmt(mean+margin) + ']', 'ok');
      this.line('    z* = ' + z, 'dim');
      this.br();
    }, 'confidence <mean> <sigma> <n> [level]\n  Confidence interval for the mean.\n  Example:  confidence 100 15 36 95');

    // ======================== COMBINE ========================
    this.reg('combine', args => {
      if (args.length < 3) { this.line('  Usage: combine <fn1> <op> <fn2>', 'warn'); this.line('  Ops: add sub mul div comp', 'dim'); return; }
      const fn1=args[0], op=args[1].toLowerCase(), fn2=args[2]; const x=2;
      try {
        const w = (s) => s.replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan');
        const f1=new Function('x','return '+w(fn1)), f2=new Function('x','return '+w(fn2));
        if(op==='comp'||op==='compose'||op==='o') { const val=f1(f2(x)); this.line('  f' + String.fromCharCode(0x2218) + 'g = ' + fn1 + ' o ' + fn2, ''); this.line('  (f' + String.fromCharCode(0x2218) + 'g)(' + x + ') = f(g(' + x + ')) = f(' + this.fmt(f2(x)) + ') = ' + this.fmt(val), 'ok'); }
        else { let r; if(op==='add')r=f1(x)+f2(x); else if(op==='sub')r=f1(x)-f2(x); else if(op==='mul')r=f1(x)*f2(x); else if(op==='div'){if(f2(x)===0){this.line('  Div by zero.', 'err');return;}r=f1(x)/f2(x);} else {this.line('  Ops: add sub mul div comp', 'warn');return;} this.line('  (' + fn1 + ') ' + op + ' (' + fn2 + ') at x=' + x + ' = ' + this.fmt(r), 'ok'); }
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'combine <fn1> <op> <fn2>\n  Function combination/arithmetic/composition.\n  Ops: add sub mul div comp\n  Example:  combine x^2 add x\n  Example:  combine sin(x) comp x^2');

    // ======================== INTERPOLATE ========================
    this.reg('interpolate', args => {
      if (args.length < 4) { this.line('  Usage: interpolate <x1,y1> <x2,y2> ... <x>', 'warn'); return; }
      const xT = parseFloat(args[args.length-1]); if(isNaN(xT)){this.line('  Last arg must be x.', 'err');return;}
      const pts = []; args.slice(0,-1).forEach(a=>{const m=a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/);if(m)pts.push([parseFloat(m[1]),parseFloat(m[2])]);});
      if(pts.length<2){this.line('  Need >=2 points.', 'warn');return;}
      let result=0; const n=pts.length;
      for(let i=0;i<n;i++){let term=pts[i][1];for(let j=0;j<n;j++)if(i!==j)term*=(xT-pts[j][0])/(pts[i][0]-pts[j][0]);result+=term;}
      this.line('  Lagrange P(' + this.fmt(xT) + ') ' + String.fromCharCode(0x2248) + ' ' + this.fmt(result), 'ok');
      this.line('  (' + n + ' points)', 'dim');
    }, 'interpolate <points...> <x>\n  Lagrange polynomial interpolation.\n  Example:  interpolate 1,1 2,4 3,9 2.5');

    // ======================== FACTORIAL ========================
    this.reg('factorial', args => {
      if (args.length === 0) { this.line('  Usage: factorial <n>', 'warn'); return; }
      const n = parseInt(args[0]); if(isNaN(n)||n<0||n>170){this.line('  n must be 0-170.', 'warn');return;}
      const fac = (k) => {if(k<2)return 1;let r=1;for(let i=2;i<=k;i++)r*=i;return r;};
      const r = fac(n); this.line('  ' + n + '! = ' + r.toLocaleString(), 'ok');
      if(n>20) this.line('  log10(' + n + '!) = ' + this.fmt(Math.log10(r)), 'dim');
    }, 'factorial <n>\n  Compute n! (factorial).\n  Example:  factorial 10  ->  3628800');

    // ======================== RREF ========================
    this.reg('rref', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if(!m){this.line('  Usage: rref [[a,b],[c,d]]', 'warn');return;}
      let mat; try{mat=JSON.parse(m[0].replace(/;/g,'],['));}catch(e){this.line('  Invalid.', 'err');return;}
      const a = mat.map(r=>[...r]); let rows=a.length, cols=a[0].length, lead=0;
      for(let r=0;r<rows;r++){if(lead>=cols)break;let i=r;while(Math.abs(a[i][lead])<1e-10){i++;if(i===rows){i=r;lead++;if(lead===cols)break;}}if(lead>=cols)break;[a[r],a[i]]=[a[i],a[r]];const pv=a[r][lead];for(let j=0;j<cols;j++)a[r][j]/=pv;for(let i=0;i<rows;i++)if(i!==r){const f=a[i][lead];for(let j=0;j<cols;j++)a[i][j]-=f*a[r][j];}lead++;}
      const fM = (mm) => mm.map(r => '  | ' + r.map(v=>this.fmt(v)).join('  ') + ' |').join('\n');
      this.line('  RREF ='); this.line(fM(a), 'ok');
    }, 'rref <matrix>\n  Row-reduced echelon form.\n  Example:  rref [[1,2,3],[4,5,6],[7,8,9]]');

    // ======================== RPN ========================
    this.reg('rpn', args => {
      if (args.length === 0) { this.line('  Usage: rpn <expr>  (Reverse Polish Notation)', 'warn'); this.line('  Example: rpn 3 4 + 2 *  ( = 14)', 'dim'); return; }
      const stack = [];
      args.forEach(tok => {
        const n = parseFloat(tok);
        if (!isNaN(n)) { stack.push(n); return; }
        if (stack.length < 2) { this.line('  Stack underflow.', 'err'); return; }
        const b = stack.pop(), a = stack.pop();
        if (tok === '+') stack.push(a + b);
        else if (tok === '-') stack.push(a - b);
        else if (tok === '*') stack.push(a * b);
        else if (tok === '/') stack.push(b === 0 ? NaN : a / b);
        else if (tok === '^' || tok === '**') stack.push(Math.pow(a, b));
        else { this.line('  Unknown op: ' + tok, 'err'); stack.push(a); stack.push(b); return; }
      });
      if (stack.length === 0) return;
      this.line('  Result: ' + this.fmt(stack[stack.length-1]), 'ok');
      if (stack.length > 1) this.line('  Stack: [' + stack.map(v=>this.fmt(v)).join(', ') + ']', 'dim');
    }, 'rpn <expression>\n  Reverse Polish Notation calculator.\n  Example:  rpn 3 4 + 2 *   ( = (3+4)*2 = 14 )\n  Example:  rpn 5 1 2 + 4 * + 3 -   ( = 14 )');

    // ======================== HYPOTHESIS ========================
    this.reg('hypothesis', args => {
      if (args.length < 4) { this.line('  Usage: hypothesis <mu0> <sigma> <xbar> <n> [tail]', 'warn'); this.line('  tail: two (default), left, right', 'dim'); return; }
      const mu0=parseFloat(args[0]), sigma=parseFloat(args[1]), xbar=parseFloat(args[2]), n=parseInt(args[3]); const tail=args[4]||'two';
      if(isNaN(mu0)||isNaN(sigma)||isNaN(xbar)||isNaN(n)||n<1){this.line('  Invalid.', 'err');return;}
      const se = sigma/Math.sqrt(n); const z = (xbar-mu0)/se;
      const pTwo = 2*(1-0.5*(1+Math.erf ? 1 : 0)); // approximation
      const p = (z) => { // standard normal CDF approximation
        const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p_=0.3275911;
        const sign=z<0?-1:1; const x=Math.abs(z)/Math.sqrt(2);
        const t=1/(1+p_*x); const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
        return 0.5*(1+sign*y);
      };
      const cdf = p(z); const pVal = tail==='left'?cdf : tail==='right'?1-cdf : 2*Math.min(cdf,1-cdf);
      this.br(); this.line('  One-Sample Z-Test:', 'head');
      this.line('    H' + String.fromCharCode(0x2080) + ': ' + String.fromCharCode(0x03BC) + ' = ' + mu0, '');
      this.line('    z = ' + this.fmt(z) + '  |  SE = ' + this.fmt(se), '');
      this.line('    p-value = ' + this.fmt(pVal) + '  (' + tail + '-tailed)', 'ok');
      this.line('    x' + String.fromCharCode(0x0304) + ' = ' + this.fmt(xbar) + '  n = ' + n, 'dim');
      if(pVal<0.05) this.line('    Result: Reject H' + String.fromCharCode(0x2080) + ' (p < 0.05)', 'warn');
      else this.line('    Result: Fail to reject H' + String.fromCharCode(0x2080) + ' (p >= 0.05)', 'dim');
      this.br();
    }, 'hypothesis <mu0> <sigma> <xbar> <n> [tail]\n  One-sample z-test for the mean.\n  tail: two (default), left, right\n  Example:  hypothesis 100 15 105 36');

    // ======================== MODINV ========================
    this.reg('modinv', args => {
      if (args.length < 2) { this.line('  Usage: modinv <a> <m>', 'warn'); return; }
      let a = parseInt(args[0]), m = parseInt(args[1]);
      if (isNaN(a) || isNaN(m) || m < 2) { this.line('  Invalid.', 'err'); return; }
      const m0 = m; a = ((a % m) + m) % m;
      if (m === 1) { this.line('  No inverse (mod 1).', 'err'); return; }
      let x0 = 0, x1 = 1, t, q, origM = m;
      while (a > 1) { q = Math.floor(a / m); t = m; m = a % m; a = t; t = x0; x0 = x1 - q * x0; x1 = t; }
      if (a !== 1) { this.line('  No modular inverse (gcd ≠ 1).', 'err'); return; }
      this.line('  ' + args[0] + String.fromCharCode(0x207B, 0x00B9) + ' mod ' + origM + ' = ' + ((x1 % m0) + m0) % m0, 'ok');
    }, 'modinv <a> <m>\n  Modular multiplicative inverse.\n  Example:  modinv 3 7  ->  5');

    // ======================== MODEXP ========================
    this.reg('modexp', args => {
      if (args.length < 3) { this.line('  Usage: modexp <base> <exp> <mod>', 'warn'); return; }
      let b = BigInt ? BigInt(args[0]) : null, e = parseInt(args[1]), m = parseInt(args[2]);
      if (!b || isNaN(e) || isNaN(m)) { this.line('  Using Number (large values may lose precision).', 'dim');
        let base = parseInt(args[0]), exp = parseInt(args[1]), mod = parseInt(args[2]);
        if (isNaN(base) || isNaN(exp) || isNaN(mod)) { this.line('  Invalid.', 'err'); return; }
        let r = 1; base = base % mod;
        while (exp > 0) { if (exp & 1) r = (r * base) % mod; exp >>= 1; base = (base * base) % mod; }
        this.line('  ' + args[0] + '^' + args[1] + ' mod ' + args[2] + ' = ' + r, 'ok'); return;
      }
      // BigInt path
      let r = 1n; const mod = BigInt(m); b %= mod; let exp = BigInt(e);
      while (exp > 0n) { if (exp & 1n) r = (r * b) % mod; exp >>= 1n; b = (b * b) % mod; }
      this.line('  ' + args[0] + '^' + args[1] + ' mod ' + args[2] + ' = ' + r.toString(), 'ok');
    }, 'modexp <base> <exp> <mod>\n  Modular exponentiation (fast exponentiation).\n  Example:  modexp 2 10 1000  ->  24');

    // ======================== CRT ========================
    this.reg('crt', args => {
      if (args.length < 4 || args.length % 2 !== 0) { this.line('  Usage: crt <a1> <m1> <a2> <m2> [a3 m3 ...]', 'warn'); return; }
      const remainders = [], moduli = [];
      for (let i = 0; i < args.length; i += 2) { const a = parseInt(args[i]), m = parseInt(args[i+1]); if (isNaN(a) || isNaN(m) || m < 1) { this.line('  Invalid.', 'err'); return; } remainders.push(((a % m) + m) % m); moduli.push(m); }
      let M = 1n, rs = remainders.map(r => BigInt(r)), ms = moduli.map(m => BigInt(m));
      ms.forEach(m => M *= m);
      let result = 0n;
      for (let i = 0; i < ms.length; i++) {
        const Mi = M / ms[i]; let inv = 1n;
        // Extended Euclidean for modular inverse of Mi mod ms[i]
        let a = Mi, b = ms[i], x0 = 1n, x1 = 0n;
        while (b > 0n) { const q = a / b; [a, b] = [b, a - q * b]; [x0, x1] = [x1, x0 - q * x1]; }
        inv = ((x0 % ms[i]) + ms[i]) % ms[i];
        result += rs[i] * Mi * inv;
      }
      result = ((result % M) + M) % M;
      this.line('  Solution: x ' + String.fromCharCode(0x2261) + ' ' + result.toString() + ' (mod ' + M.toString() + ')', 'ok');
    }, 'crt <a1> <m1> <a2> <m2> [a3 m3 ...]\n  Chinese Remainder Theorem.\n  Example:  crt 2 3 3 5 2 7  ->  x ≡ 23 (mod 105)');

    // ======================== TOTIENT ========================
    this.reg('totient', args => {
      if (args.length === 0) { this.line('  Usage: totient <n>', 'warn'); return; }
      let n = parseInt(args[0]); if (isNaN(n) || n < 1) { this.line('  Positive integer only.', 'err'); return; }
      const orig = n; let result = n;
      for (let p = 2; p * p <= n; p++) { if (n % p === 0) { while (n % p === 0) n /= p; result -= result / p; } }
      if (n > 1) result -= result / n;
      this.line('  ' + String.fromCharCode(0x03C6) + '(' + orig + ') = ' + result, 'ok');
    }, 'totient <n>\n  Eulers totient function φ(n).\n  Example:  totient 36  ->  12');

    // ======================== DIGIT ========================
    this.reg('digit', args => {
      if (args.length === 0) { this.line('  Usage: digit <n>', 'warn'); return; }
      const n = args[0]; const digits = n.replace(/^-?/, '').split('').map(Number).filter(d => !isNaN(d));
      if (digits.length === 0) { this.line('  Not a number.', 'err'); return; }
      const sum = digits.reduce((a,b) => a+b, 0);
      const prod = digits.reduce((a,b) => a*b, 1);
      const root = sum < 10 ? sum : (sum % 9 === 0 ? 9 : sum % 9);
      const rev = digits.slice().reverse().join('');
      this.line('  Digit sum: ' + sum + '  |  Digital root: ' + root, '');
      this.line('  Digit product: ' + prod.toLocaleString(), '');
      this.line('  Digit count: ' + digits.length + '  |  Reversed: ' + rev, 'dim');
    }, 'digit <n>\n  Digit analysis: sum, product, root, count, reverse.\n  Example:  digit 12345');

    // ======================== ISPAL ========================
    this.reg('ispal', args => {
      if (args.length === 0) { this.line('  Usage: ispal <n>', 'warn'); return; }
      const s = args[0].replace(/^-?/, '');
      const pal = s === s.split('').reverse().join('');
      this.line('  ' + args[0] + (pal ? ' is' : ' is not') + ' a palindrome.', pal ? 'ok' : 'err');
    }, 'ispal <n>\n  Check if a number is a palindrome.\n  Example:  ispal 12321  ->  yes');

    // ======================== ISPERFECT ========================
    this.reg('isperfect', args => {
      if (args.length === 0) { this.line('  Usage: isperfect <n>', 'warn'); return; }
      let n = parseInt(args[0]); if (isNaN(n) || n < 1) { this.line('  Positive integer only.', 'err'); return; }
      let sum = 1;
      for (let i = 2; i * i <= n; i++) { if (n % i === 0) { sum += i; if (i * i !== n) sum += n / i; } }
      const perf = sum === n && n !== 1;
      this.line('  ' + n + (perf ? ' is' : ' is not') + ' a perfect number.', perf ? 'ok' : '');
      if (!perf) this.line('  Sum of proper divisors: ' + sum + ' (difference: ' + Math.abs(sum - n) + ')', 'dim');
    }, 'isperfect <n>\n  Check if a number is perfect (sum of proper divisors = n).\n  Example:  isperfect 28  ->  yes');

    // ======================== COLLATZ ========================
    this.reg('collatz', args => {
      if (args.length === 0) { this.line('  Usage: collatz <n>', 'warn'); return; }
      let n = parseInt(args[0]); if (isNaN(n) || n < 1) { this.line('  Positive integer only.', 'err'); return; }
      const seq = [n]; const orig = n;
      while (n !== 1) { if (n % 2 === 0) n /= 2; else n = 3 * n + 1; seq.push(n); if (seq.length > 1000) { this.line('  Sequence too long (>1000).', 'warn'); break; } }
      this.line('  Collatz(' + orig + '): ' + seq.length + ' steps, max=' + Math.max(...seq), '');
      const chunks = []; for (let i = 0; i < Math.min(seq.length, 40); i += 10) chunks.push(seq.slice(i, i+10).join(' ' + String.fromCharCode(0x2192) + ' '));
      chunks.forEach(c => this.line('    ' + c, 'dim'));
      if (seq.length > 40) this.line('    ... (' + (seq.length - 40) + ' more)', 'dim');
      this.line('  Stopping time: ' + (seq.length - 1) + ' steps', 'ok');
    }, 'collatz <n>\n  Collatz (3n+1) sequence.\n  Example:  collatz 27');

    // ======================== GOLDBACH ========================
    this.reg('goldbach', args => {
      if (args.length === 0) { this.line('  Usage: goldbach <n>', 'warn'); return; }
      let n = parseInt(args[0]); if (isNaN(n) || n < 4 || n % 2 !== 0) { this.line('  Enter an even number ≥ 4.', 'err'); return; }
      const sieve = new Array(n + 1).fill(true); sieve[0] = sieve[1] = false;
      for (let i = 2; i * i <= n; i++) if (sieve[i]) for (let j = i * i; j <= n; j += i) sieve[j] = false;
      const primes = []; for (let i = 2; i <= n; i++) if (sieve[i]) primes.push(i);
      const pairs = []; const seen = new Set();
      for (const p of primes) { const q = n - p; if (q >= p && sieve[q] && !seen.has(p)) { pairs.push([p, q]); seen.add(p); seen.add(q); } }
      this.line('  Goldbach pairs for ' + n + ' (' + pairs.length + '):', 'head');
      pairs.forEach(([a, b]) => this.line('    ' + n + ' = ' + a + ' + ' + b, ''));
    }, 'goldbach <n>\n  Goldbach decomposition (even n ≥ 4).\n  Example:  goldbach 100');

    // ======================== GRADIENT ========================
    this.reg('gradient', args => {
      if (args.length < 3) { this.line('  Usage: gradient <fn(x,y)> <x> <y>', 'warn'); return; }
      const fnStr = args.slice(0, -2).join(' '); const x = parseFloat(args[args.length - 2]), y = parseFloat(args[args.length - 1]);
      if (isNaN(x) || isNaN(y)) { this.line('  Invalid.', 'err'); return; }
      try {
        const f = new Function('x', 'y', 'return ' + fnStr.replace(/\^/g, '**'));
        const h = 1e-8;
        const dfdx = (f(x + h, y) - f(x - h, y)) / (2 * h);
        const dfdy = (f(x, y + h) - f(x, y - h)) / (2 * h);
        const mag = Math.sqrt(dfdx * dfdx + dfdy * dfdy);
        this.line('  f(x,y) = ' + fnStr, '');
        this.line('  ' + String.fromCharCode(0x2207) + 'f(' + this.fmt(x) + ', ' + this.fmt(y) + ') = (' + this.fmt(dfdx) + ', ' + this.fmt(dfdy) + ')', 'ok');
        this.line('  |' + String.fromCharCode(0x2207) + 'f| = ' + this.fmt(mag) + '  |  direction: ' + this.fmt(Math.atan2(dfdy, dfdx) * 180 / Math.PI) + String.fromCharCode(0x00B0), 'dim');
      } catch (e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'gradient <fn(x,y)> <x> <y>\n  Numerical gradient in 2D.\n  Example:  gradient x^2+y^2 1 1  ->  (2, 2)');

    // ======================== LAPLACE ========================
    this.reg('laplace', args => {
      if (args.length < 2) { this.line('  Usage: laplace <fn(t)> <s>', 'warn'); return; }
      const fnStr = args.slice(0, -1).join(' '); const s = parseFloat(args[args.length - 1]);
      if (isNaN(s)) { this.line('  Invalid s.', 'err'); return; }
      try {
        const f = new Function('t', 'return ' + fnStr.replace(/\^/g, '**'));
        const n = 2000; const h = 50 / n; let sum = 0;
        for (let i = 0; i < n; i++) { const t = (i + 0.5) * h; const v = f(t) * Math.exp(-s * t); if (isFinite(v)) sum += v; }
        const L = sum * h;
        this.line('  L{f(t)} at s=' + this.fmt(s) + ' ' + String.fromCharCode(0x2248) + ' ' + this.fmt(L), 'ok');
        this.line('  (Numerical Laplace, 0→50, n=' + n + ')', 'dim');
      } catch (e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'laplace <fn(t)> <s>\n  Numerical Laplace transform at point s.\n  Example:  laplace t 2  ->  ~1/4');

    // ======================== CONVOLVE ========================
    this.reg('convolve', args => {
      if (args.length < 3) { this.line('  Usage: convolve <fn> <gn> <t>', 'warn'); return; }
      const fnStr = args[0], gnStr = args[1]; const t = parseFloat(args[2]);
      if (isNaN(t)) { this.line('  Invalid t.', 'err'); return; }
      try {
        const w = (s) => s.replace(/\^/g, '**');
        const f = new Function('x', 'return ' + w(fnStr)), g = new Function('x', 'return ' + w(gnStr));
        const n = 1000; const h = t / n; let sum = 0;
        for (let i = 0; i <= n; i++) { const tau = i * h; const v = f(tau) * g(t - tau); if (isFinite(v)) sum += v; }
        const result = sum * h;
        this.line('  (f*g)(' + this.fmt(t) + ') ' + String.fromCharCode(0x2248) + ' ' + this.fmt(result), 'ok');
        this.line('  f=' + fnStr + '  g=' + gnStr + '  n=' + n, 'dim');
      } catch (e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'convolve <fn> <gn> <t>\n  Convolution (f*g)(t) via numerical integration.\n  Example:  convolve t t 1');

    // ======================== RK4 ========================
    this.reg('rk4', args => {
      if (args.length < 5) { this.line('  Usage: rk4 <f(x,y)> <x0> <y0> <x1> <n>', 'warn'); return; }
      const fnStr = args[0]; const x0 = parseFloat(args[1]), y0 = parseFloat(args[2]), x1 = parseFloat(args[3]); const n = Math.min(10000, Math.max(1, parseInt(args[4])));
      if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      try {
        const f = new Function('x', 'y', 'return ' + fnStr.replace(/\^/g, '**'));
        const h = (x1 - x0) / n; let x = x0, y = y0;
        this.line('  RK4: dy/dx = ' + fnStr + ', y(' + this.fmt(x0) + ') = ' + this.fmt(y0), '');
        this.line('  x' + String.fromCharCode(0x2081) + '=' + this.fmt(x1) + ' n=' + n + ' h=' + this.fmt(h), 'dim'); this.br();
        for (let i = 0; i < n; i++) {
          const k1 = f(x, y), k2 = f(x + h / 2, y + h * k1 / 2), k3 = f(x + h / 2, y + h * k2 / 2), k4 = f(x + h, y + h * k3);
          y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h;
          if (i < 3 || i === n - 1 || i % Math.max(1, Math.floor(n / 5)) === 0) this.line('    Step ' + (i + 1) + ': x=' + this.fmt(x) + '  y=' + this.fmt(y), 'dim');
        }
        this.br(); this.line('  y(' + this.fmt(x1) + ') ' + String.fromCharCode(0x2248) + ' ' + this.fmt(y), 'ok');
      } catch (e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'rk4 <f(x,y)> <x0> <y0> <x1> <n>\n  Runge-Kutta 4th order ODE solver.\n  Example:  rk4 y 0 1 2 10');

    // ======================== EIGEN ========================
    this.reg('eigen', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: eigen [[a,b],[c,d]]', 'warn'); this.line('  2×2 matrix only.', 'dim'); return; }
      let mat; try { mat = JSON.parse(m[0].replace(/;/g, '],[')); } catch (e) { this.line('  Invalid.', 'err'); return; }
      if (mat.length !== 2 || mat[0].length !== 2) { this.line('  2×2 only.', 'err'); return; }
      const [[a, b], [c, d]] = mat; const tr = a + d, det = a * d - b * c; const disc = tr * tr - 4 * det;
      this.br(); this.line('  Matrix A = [[a,b],[c,d]]', '');
      this.line('  Trace = ' + this.fmt(tr) + '  |  Det = ' + this.fmt(det), 'dim');
      this.line('  Char poly: ' + String.fromCharCode(0x03BB) + String.fromCharCode(0x00B2) + ' - (' + this.fmt(tr) + ')' + String.fromCharCode(0x03BB) + ' + ' + this.fmt(det), '');
      if (disc > 0) {
        const l1 = (tr + Math.sqrt(disc)) / 2, l2 = (tr - Math.sqrt(disc)) / 2;
        this.line('  ' + String.fromCharCode(0x03BB) + String.fromCharCode(0x2081) + ' = ' + this.fmt(l1), 'ok');
        this.line('  ' + String.fromCharCode(0x03BB) + String.fromCharCode(0x2082) + ' = ' + this.fmt(l2), 'ok');
        // Eigenvectors
        if (Math.abs(b) > 1e-12) { this.line('  v' + String.fromCharCode(0x2081) + ' = (' + this.fmt(l1 - d) + ', ' + this.fmt(b) + ')', 'dim'); this.line('  v' + String.fromCharCode(0x2082) + ' = (' + this.fmt(l2 - d) + ', ' + this.fmt(b) + ')', 'dim'); }
        else if (Math.abs(c) > 1e-12) { this.line('  v' + String.fromCharCode(0x2081) + ' = (' + this.fmt(c) + ', ' + this.fmt(l1 - a) + ')', 'dim'); this.line('  v' + String.fromCharCode(0x2082) + ' = (' + this.fmt(c) + ', ' + this.fmt(l2 - a) + ')', 'dim'); }
      } else if (disc === 0) {
        this.line('  ' + String.fromCharCode(0x03BB) + ' = ' + this.fmt(tr / 2) + ' (double)', 'ok');
      } else {
        const re = tr / 2, im = Math.sqrt(-disc) / 2;
        this.line('  ' + String.fromCharCode(0x03BB) + String.fromCharCode(0x2081) + ' = ' + this.fmt(re) + ' + ' + this.fmt(im) + 'i', 'ok');
        this.line('  ' + String.fromCharCode(0x03BB) + String.fromCharCode(0x2082) + ' = ' + this.fmt(re) + ' - ' + this.fmt(im) + 'i', 'ok');
      }
      this.br();
    }, 'eigen <matrix>\n  Eigenvalues and eigenvectors of a 2×2 matrix.\n  Example:  eigen [[2,1],[1,2]]');

    // ======================== NORM ========================
    this.reg('norm', args => {
      if (args.length < 2) { this.line('  Usage: norm <type> <v>  |  types: L1, L2 (default), Linf', 'warn'); return; }
      let type = 'L2', vecStr;
      if (args[0].toLowerCase().startsWith('l')) { type = args[0].toUpperCase(); vecStr = args.slice(1).join(' '); }
      else { vecStr = args.join(' '); }
      const parse = (s) => { const m = s.match(/\[?([\d.-]+(?:,\s*[\d.-]+)*)\]?/); return m ? m[1].split(/,\s*/).map(parseFloat).filter(v => isFinite(v)) : []; };
      const vec = parse(vecStr);
      if (vec.length === 0) { this.line('  Format: 1,2,3 or [1,2,3]', 'err'); return; }
      let result;
      if (type === 'L1') result = vec.reduce((s, v) => s + Math.abs(v), 0);
      else if (type === 'L2') result = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      else if (type === 'LINF' || type === 'LINF') result = Math.max(...vec.map(v => Math.abs(v)));
      else { this.line('  Types: L1, L2, Linf', 'warn'); return; }
      this.line('  ||v||' + (type === 'LINF' ? String.fromCharCode(0x221E) : (type === 'L2' ? '' : String.fromCharCode(0x2081))) + ' = ' + this.fmt(result), 'ok');
    }, 'norm <type> <v>\n  Vector norm. Types: L1, L2 (default), Linf.\n  Example:  norm L1 1,2,3  ->  6\n  Example:  norm 3,4  ->  5');

    // ======================== TRACE ========================
    this.reg('trace', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: trace [[a,b],[c,d]]', 'warn'); return; }
      let mat; try { mat = JSON.parse(m[0].replace(/;/g, '],[')); } catch (e) { this.line('  Invalid.', 'err'); return; }
      if (mat.length !== mat[0].length) { this.line('  Square matrix only.', 'err'); return; }
      const t = mat.reduce((s, r, i) => s + r[i], 0);
      this.line('  tr(A) = ' + this.fmt(t), 'ok');
    }, 'trace <matrix>\n  Trace of a square matrix (sum of diagonal).\n  Example:  trace [[1,2],[3,4]]  ->  5');

    // ======================== OUTER ========================
    this.reg('outer', args => {
      if (args.length < 2) { this.line('  Usage: outer <v1> <v2>', 'warn'); return; }
      const pV = (s) => { const m = s.match(/\[?([\d.-]+(?:,\s*[\d.-]+)*)\]?/); return m ? m[1].split(/,\s*/).map(parseFloat).filter(v => isFinite(v)) : []; };
      const v1 = pV(args[0]), v2 = pV(args[1]);
      if (v1.length === 0 || v2.length === 0) { this.line('  Invalid vectors.', 'err'); return; }
      const result = v1.map(a => v2.map(b => a * b));
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.line('  v' + String.fromCharCode(0x2297) + 'w = v' + String.fromCharCode(0x00D7) + 'w' + String.fromCharCode(0x1D40) + ' ='); this.line(fM(result), 'ok');
    }, 'outer <v1> <v2>\n  Outer product (tensor product) of two vectors.\n  Example:  outer 1,2 3,4');

    // ======================== PROJECT ========================
    this.reg('project', args => {
      if (args.length < 2) { this.line('  Usage: project <v> <u>', 'warn'); return; }
      const pV = (s) => { const m = s.match(/\[?([\d.-]+(?:,\s*[\d.-]+)*)\]?/); return m ? m[1].split(/,\s*/).map(parseFloat).filter(v => isFinite(v)) : []; };
      const v = pV(args[0]), u = pV(args[1]);
      if (v.length === 0 || u.length === 0) { this.line('  Invalid vectors.', 'err'); return; }
      const vs = (vec) => '(' + vec.map(x => this.fmt(x)).join(', ') + ')';
      const dot = (a, b) => a.reduce((s, x, i) => s + x * (b[i] || 0), 0);
      const uv = dot(u, u); if (uv === 0) { this.line('  Zero vector.', 'err'); return; }
      const scalar = dot(v, u) / uv;
      const proj = u.map(x => scalar * x);
      const rej = v.map((x, i) => x - (proj[i] || 0));
      this.line('  v = ' + vs(v) + ',  u = ' + vs(u), '');
      this.line('  proj_u(v) = ' + vs(proj), 'ok');
      this.line('  perp_u(v) = ' + vs(rej), 'dim');
      this.line('  scalar = ' + this.fmt(scalar), 'dim');
    }, 'project <v> <u>\n  Vector projection of v onto u.\n  Example:  project 3,4 1,0  ->  (3,0)');

    // ======================== LEAST ========================
    this.reg('least', args => {
      if (args.length < 4) { this.line('  Usage: least <points...> [degree]', 'warn'); this.line('  Format: x,y  |  Last arg = degree (default 1)', 'dim'); return; }
      const pts = []; let lastArg = args[args.length - 1];
      args.forEach(a => { const m = a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/); if (m) pts.push([parseFloat(m[1]), parseFloat(m[2])]); });
      const deg = pts.length < args.length && !isNaN(parseFloat(lastArg)) ? Math.min(5, Math.max(1, parseInt(lastArg))) : 1;
      while (pts.length < args.length && deg < args.length - pts.length) { } // consume degree arg
      // Actually simpler: if last arg is a number with no comma, use as degree
      if (args[args.length - 1].indexOf(',') === -1 && !isNaN(parseFloat(args[args.length - 1]))) {
        pts.pop(); // remove degree from points
      }
      if (pts.length < 2) { this.line('  Need at least 2 points.', 'warn'); return; }
      const fn = deg;
      // Build Vandermonde matrix and solve normal equations
      const n = pts.length, m = fn + 1;
      const X = pts.map(p => p[0]), Y = pts.map(p => p[1]);
      const A = Array.from({ length: m }, () => Array(m).fill(0));
      const B = Array(m).fill(0);
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
        A[i][j] = X.reduce((s, x) => s + Math.pow(x, i + j), 0);
      }
      for (let i = 0; i < m; i++) B[i] = X.reduce((s, x, idx) => s + Math.pow(x, i) * Y[idx], 0);
      // Solve via Gaussian elimination
      for (let col = 0; col < m; col++) {
        let maxRow = col; for (let row = col + 1; row < m; row++) if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
        [A[col], A[maxRow]] = [A[maxRow], A[col]]; [B[col], B[maxRow]] = [B[maxRow], B[col]];
        const pv = A[col][col]; if (Math.abs(pv) < 1e-15) continue;
        for (let row = col; row < m; row++) A[col][row] /= pv; B[col] /= pv;
        for (let row = 0; row < m; row++) if (row !== col) { const f = A[row][col]; for (let j = col; j < m; j++) A[row][j] -= f * A[col][j]; B[row] -= f * B[col]; }
      }
      this.br(); this.line('  Polynomial Least Squares (degree ' + fn + ', n=' + n + '):', 'head');
      const terms = [];
      for (let i = m - 1; i >= 0; i--) { if (Math.abs(B[i]) < 1e-15) continue;
        const s = terms.length === 0 ? (B[i] < 0 ? '-' : '') : (B[i] < 0 ? ' - ' : ' + ');
        const a = Math.abs(B[i]); terms.push(s + (i === 0 ? this.fmt(a) : i === 1 ? (a === 1 ? '' : this.fmt(a)) + 'x' : (a === 1 ? '' : this.fmt(a)) + 'x^' + i)); }
      this.line('  P(x) = ' + (terms.join('') || '0'), 'ok');
      // R²
      const yMean = Y.reduce((s, v) => s + v, 0) / n;
      const predict = (x) => B.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
      const ssRes = pts.reduce((s, p) => s + Math.pow(p[1] - predict(p[0]), 2), 0);
      const ssTot = pts.reduce((s, p) => s + Math.pow(p[1] - yMean, 2), 0);
      this.line('  R' + String.fromCharCode(0x00B2) + ' = ' + this.fmt(1 - ssRes / ssTot), 'dim');
      this.line('  Coefficients: [' + B.map(v => this.fmt(v)).join(', ') + ']', 'dim');
      this.br();
    }, 'least <points...> [degree]\n  Polynomial least-squares fit (degree 1-5).\n  Example:  least 1,2 2,4 3,5 4,8 2');

    // ======================== TTEST ========================
    this.reg('ttest', args => {
      if (args.length < 6) { this.line('  Usage: ttest <xbar1> <s1> <n1> <xbar2> <s2> <n2>', 'warn'); return; }
      const [x1, s1, n1, x2, s2, n2] = args.map(parseFloat);
      if ([x1, s1, n1, x2, s2, n2].some(v => isNaN(v) || v <= 0)) { this.line('  All values must be positive.', 'err'); return; }
      const se = Math.sqrt(s1 * s1 / n1 + s2 * s2 / n2);
      const t = (x1 - x2) / se;
      const dfNum = Math.pow(s1 * s1 / n1 + s2 * s2 / n2, 2);
      const dfDen = Math.pow(s1 * s1 / n1, 2) / (n1 - 1) + Math.pow(s2 * s2 / n2, 2) / (n2 - 1);
      const df = Math.floor(dfNum / dfDen);
      this.br(); this.line('  Welch Two-Sample t-Test:', 'head');
      this.line('    t = ' + this.fmt(t) + '  |  df = ' + df, '');
      this.line('    SE = ' + this.fmt(se) + '  |  Difference = ' + this.fmt(x1 - x2), 'dim');
      this.line('    Group 1: x' + String.fromCharCode(0x0304) + '=' + this.fmt(x1) + ' s=' + this.fmt(s1) + ' n=' + n1, '');
      this.line('    Group 2: x' + String.fromCharCode(0x0304) + '=' + this.fmt(x2) + ' s=' + this.fmt(s2) + ' n=' + n2, '');
      // Approximate p-value using t distribution
      const p = (tVal, dfVal) => { const x = dfVal / (dfVal + tVal * tVal); return this._incBeta(x, dfVal / 2, 0.5); };
      this.line('    p-value ' + String.fromCharCode(0x2248) + ' ' + this.fmt(p(Math.abs(t), df)) + ' (two-tailed)', 'ok');
      this.br();
    }, 'ttest <xbar1> <s1> <n1> <xbar2> <s2> <n2>\n  Welch two-sample t-test.\n  Example:  ttest 105 10 30 100 12 35');

    // ======================== CHI2 ========================
    this.reg('chi2', args => {
      if (args.length < 4) { this.line('  Usage: chi2 <observed> <expected>', 'warn'); this.line('  Or: chi2 <O1> <E1> <O2> <E2> ...', 'dim'); return; }
      const nums = args.map(parseFloat).filter(v => isFinite(v));
      if (nums.length < 4 || nums.length % 2 !== 0) { this.line('  Need pairs of (observed, expected).', 'warn'); return; }
      let chi2 = 0; const n = nums.length / 2; let df = n - 1;
      for (let i = 0; i < n; i++) { const O = nums[2 * i], E = nums[2 * i + 1]; if (E <= 0) { this.line('  Expected must be > 0.', 'err'); return; } chi2 += (O - E) * (O - E) / E; }
      this.br(); this.line('  Chi-Square Test:', 'head');
      this.line('    ' + String.fromCharCode(0x03C7) + String.fromCharCode(0x00B2) + ' = ' + this.fmt(chi2), 'ok');
      this.line('    df = ' + df, '');
      const pVal = 1 - this._regGamma(df / 2, chi2 / 2);
      this.line('    p-value ' + String.fromCharCode(0x2248) + ' ' + this.fmt(pVal), 'dim');
      if (pVal < 0.05) this.line('    Result: Reject H' + String.fromCharCode(0x2080) + ' (p < 0.05)', 'warn');
      else this.line('    Result: Fail to reject H' + String.fromCharCode(0x2080) + ' (p >= 0.05)', 'dim');
      this.br();
    }, 'chi2 <O1> <E1> <O2> <E2> ...\n  Chi-square goodness-of-fit test.\n  Example:  chi2 10 12 20 18 30 28');

    // ======================== ANOVA ========================
    this.reg('anova', args => {
      if (args.length < 6) { this.line('  Usage: anova <group1-numbers> <group2-numbers> [group3 ...]', 'warn'); this.line('  Separate groups with "/"', 'dim'); return; }
      const groups = []; let current = [];
      args.forEach(a => { if (a === '/') { if (current.length > 0) { groups.push(current); current = []; } } else { const v = parseFloat(a); if (isFinite(v)) current.push(v); } });
      if (current.length > 0) groups.push(current);
      if (groups.length < 2 || groups.some(g => g.length < 2)) { this.line('  Need at least 2 groups with 2+ values each.', 'err'); return; }
      const all = groups.flat(); const grandMean = all.reduce((s, v) => s + v, 0) / all.length;
      let ssBetween = 0, ssWithin = 0;
      groups.forEach(g => { const m = g.reduce((s, v) => s + v, 0) / g.length; ssBetween += g.length * Math.pow(m - grandMean, 2); ssWithin += g.reduce((s, v) => s + Math.pow(v - m, 2), 0); });
      const dfB = groups.length - 1, dfW = all.length - groups.length;
      const msB = ssBetween / dfB, msW = ssWithin / dfW;
      const F = msB / msW;
      this.br(); this.line('  One-Way ANOVA:', 'head');
      this.line('    Source     SS      df     MS       F', '');
      this.line('  ' + String.fromCharCode(0x2500).repeat(40), 'dim');
      this.line('    Between   ' + this.fmt(ssBetween).padStart(7) + ' ' + dfB.toString().padStart(3) + ' ' + this.fmt(msB).padStart(7) + ' ' + this.fmt(F).padStart(7), 'ok');
      this.line('    Within    ' + this.fmt(ssWithin).padStart(7) + ' ' + dfW.toString().padStart(3) + ' ' + this.fmt(msW).padStart(7), '');
      this.line('    Total     ' + this.fmt(ssBetween + ssWithin).padStart(7) + ' ' + (dfB + dfW).toString().padStart(3), 'dim');
      this.br();
    }, 'anova <group1> / <group2> [/ group3 ...]\n  One-way ANOVA. Separate groups with "/".\n  Example:  anova 2 3 4 / 5 6 7');

    // ======================== BOOTSTRAP ========================
    this.reg('bootstrap', args => {
      if (args.length < 3) { this.line('  Usage: bootstrap <numbers...> <B>', 'warn'); return; }
      const B = Math.min(10000, parseInt(args[args.length - 1]) || 1000);
      const data = args.slice(0, -1).map(parseFloat).filter(v => isFinite(v));
      if (data.length < 3) { this.line('  Need at least 3 values.', 'err'); return; }
      const n = data.length; const means = [];
      for (let b = 0; b < B; b++) { let sum = 0; for (let i = 0; i < n; i++) sum += data[Math.floor(Math.random() * n)]; means.push(sum / n); }
      means.sort((a, b) => a - b);
      const lo = means[Math.floor(B * 0.025)], hi = means[Math.floor(B * 0.975)];
      const origMean = data.reduce((s, v) => s + v, 0) / n;
      this.br(); this.line('  Bootstrap (' + B + ' resamples):', 'head');
      this.line('    Original mean: ' + this.fmt(origMean), '');
      this.line('    Bootstrap SE: ' + this.fmt(Math.sqrt(means.reduce((s, v) => s + Math.pow(v - origMean, 2), 0) / B)), 'dim');
      this.line('    95% CI: [' + this.fmt(lo) + ', ' + this.fmt(hi) + ']', 'ok');
      this.br();
    }, 'bootstrap <numbers...> <B>\n  Bootstrap confidence interval for the mean.\n  Example:  bootstrap 5 7 8 9 10 12 15 1000');

    // ======================== MONTECARLO ========================
    this.reg('montecarlo', args => {
      if (args.length < 4) { this.line('  Usage: montecarlo <fn> <a> <b> <n>', 'warn'); return; }
      const fnStr = args[0]; const a = parseFloat(args[1]), b = parseFloat(args[2]); const n = Math.min(1000000, Math.max(100, parseInt(args[3])));
      if (isNaN(a) || isNaN(b) || isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      try {
        const f = new Function('x', 'return ' + fnStr.replace(/\^/g, '**'));
        let sum = 0; let maxY = -Infinity, minY = Infinity;
        for (let i = 0; i < n; i++) { const x = a + Math.random() * (b - a); const y = f(x); if (isFinite(y)) { sum += y; if (y > maxY) maxY = y; if (y < minY) minY = y; } }
        const area = (b - a) * sum / n;
        this.line('  Monte Carlo Integration (n=' + n.toLocaleString() + '):', '');
        this.line('  ' + String.fromCharCode(0x222B) + '[' + this.fmt(a) + ', ' + this.fmt(b) + '] f(x) dx ' + String.fromCharCode(0x2248) + ' ' + this.fmt(area), 'ok');
        this.line('  f min=' + this.fmt(minY) + '  f max=' + this.fmt(maxY), 'dim');
      } catch (e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'montecarlo <fn> <a> <b> <n>\n  Monte Carlo integration.\n  Example:  montecarlo sin(x) 0 3.14159 100000');

    // ======================== POISSON ========================
    this.reg('poisson', args => {
      if (args.length < 2) { this.line('  Usage: poisson <lambda> <k>', 'warn'); return; }
      const lam = parseFloat(args[0]), k = parseInt(args[1]);
      if (isNaN(lam) || isNaN(k) || lam <= 0 || k < 0) { this.line('  λ > 0, k ≥ 0.', 'err'); return; }
      const fac = (n) => { if (n < 2) return 1; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
      const prob = Math.exp(-lam) * Math.pow(lam, k) / fac(k);
      this.line('  Poisson(λ=' + this.fmt(lam) + ')  P(X=' + k + ') = ' + this.fmt(prob), 'ok');
      // Cumulative
      let cum = 0; for (let i = 0; i <= k; i++) cum += Math.exp(-lam) * Math.pow(lam, i) / fac(i);
      this.line('  P(X ≤ ' + k + ') = ' + this.fmt(cum), 'dim');
    }, 'poisson <lambda> <k>\n  Poisson probability P(X=k).\n  Example:  poisson 4 2');

    // ======================== GEOMETRIC ========================
    this.reg('geometric', args => {
      if (args.length < 2) { this.line('  Usage: geometric <p> <k>', 'warn'); return; }
      const p = parseFloat(args[0]), k = parseInt(args[1]);
      if (isNaN(p) || isNaN(k) || p <= 0 || p >= 1 || k < 1) { this.line('  0 < p < 1, k ≥ 1.', 'err'); return; }
      const prob = Math.pow(1 - p, k - 1) * p;
      this.line('  Geometric(p=' + this.fmt(p) + ')  P(X=' + k + ') = ' + this.fmt(prob), 'ok');
      this.line('  E[X] = ' + this.fmt(1 / p) + '  |  Var = ' + this.fmt((1 - p) / (p * p)), 'dim');
    }, 'geometric <p> <k>\n  Geometric distribution P(X=k), first success at trial k.\n  Example:  geometric 0.5 3');

    // ======================== EXPONENTIAL ========================
    this.reg('exponential', args => {
      if (args.length < 2) { this.line('  Usage: exponential <lambda> <x>', 'warn'); return; }
      const lam = parseFloat(args[0]), x = parseFloat(args[1]);
      if (isNaN(lam) || isNaN(x) || lam <= 0 || x < 0) { this.line('  λ > 0, x ≥ 0.', 'err'); return; }
      const pdf = lam * Math.exp(-lam * x);
      const cdf = 1 - Math.exp(-lam * x);
      this.line('  Exponential(λ=' + this.fmt(lam) + ')  f(' + this.fmt(x) + ') = ' + this.fmt(pdf), 'ok');
      this.line('  F(' + this.fmt(x) + ') = ' + this.fmt(cdf) + '  |  E[X] = ' + this.fmt(1 / lam), 'dim');
    }, 'exponential <lambda> <x>\n  Exponential distribution PDF and CDF.\n  Example:  exponential 2 1');

    // ======================== WEIBULL ========================
    this.reg('weibull', args => {
      if (args.length < 3) { this.line('  Usage: weibull <k> <lambda> <x>', 'warn'); return; }
      const k = parseFloat(args[0]), lam = parseFloat(args[1]), x = parseFloat(args[2]);
      if (isNaN(k) || isNaN(lam) || isNaN(x) || k <= 0 || lam <= 0 || x < 0) { this.line('  k > 0, λ > 0, x ≥ 0.', 'err'); return; }
      const pdf = (k / lam) * Math.pow(x / lam, k - 1) * Math.exp(-Math.pow(x / lam, k));
      this.line('  Weibull(k=' + this.fmt(k) + ', λ=' + this.fmt(lam) + ')  f(' + this.fmt(x) + ') = ' + this.fmt(pdf), 'ok');
      this.line('  Mean = ' + this.fmt(lam * this._gamma(1 + 1 / k)), 'dim');
    }, 'weibull <k> <lambda> <x>\n  Weibull distribution PDF.\n  Example:  weibull 2 1 0.5');

    // ======================== CDFNORM ========================
    this.reg('cdfnorm', args => {
      if (args.length === 0) { this.line('  Usage: cdfnorm <x> [mu] [sigma]', 'warn'); return; }
      const x = parseFloat(args[0]), mu = args.length > 1 ? parseFloat(args[1]) : 0, sigma = args.length > 2 ? parseFloat(args[2]) : 1;
      if (isNaN(x) || isNaN(mu) || isNaN(sigma) || sigma <= 0) { this.line('  Invalid.', 'err'); return; }
      const z = (x - mu) / sigma;
      const cdf = 0.5 * (1 + this._erf(z / Math.sqrt(2)));
      const pdf = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
      this.br(); this.line('  Normal(μ=' + this.fmt(mu) + ', σ=' + this.fmt(sigma) + '):', 'head');
      this.line('    z-score = ' + this.fmt(z), '');
      this.line('    F(x) = P(X ≤ ' + this.fmt(x) + ') = ' + this.fmt(cdf), 'ok');
      this.line('    f(x) = ' + this.fmt(pdf), 'dim');
      this.br();
    }, 'cdfnorm <x> [mu] [sigma]\n  Normal CDF, PDF, and z-score.\n  Default: μ=0, σ=1.\n  Example:  cdfnorm 1.96');

    // ======================== CDFT ========================
    this.reg('cdft', args => {
      if (args.length < 2) { this.line('  Usage: cdft <t> <df>', 'warn'); return; }
      const t = parseFloat(args[0]), df = parseFloat(args[1]);
      if (isNaN(t) || isNaN(df) || df < 1) { this.line('  df ≥ 1.', 'err'); return; }
      const x = df / (df + t * t);
      const cdf = t >= 0 ? 1 - 0.5 * this._incBeta(x, df / 2, 0.5) : 0.5 * this._incBeta(x, df / 2, 0.5);
      this.line('  t(' + this.fmt(t) + ', df=' + df + ')  CDF = ' + this.fmt(cdf), 'ok');
      this.line('  P(T ≤ ' + this.fmt(t) + ') = ' + this.fmt(cdf), '');
      this.line('  Two-tailed p ' + String.fromCharCode(0x2248) + ' ' + this.fmt(2 * (1 - cdf)), 'dim');
    }, 'cdft <t> <df>\n  t-distribution CDF.\n  Example:  cdft 2 10');

    // ======================== ELLIPSE ========================
    this.reg('ellipse', args => {
      if (args.length < 2) { this.line('  Usage: ellipse <a> <b>', 'warn'); return; }
      const a = Math.abs(parseFloat(args[0])), b = Math.abs(parseFloat(args[1]));
      if (isNaN(a) || isNaN(b) || a === 0 || b === 0) { this.line('  Semi-axes must be > 0.', 'err'); return; }
      const area = Math.PI * a * b;
      const pApprox = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
      const ecc = Math.sqrt(Math.abs(a * a - b * b)) / Math.max(a, b);
      const fDist = Math.sqrt(Math.abs(a * a - b * b));
      this.line('  Ellipse (a=' + this.fmt(a) + ', b=' + this.fmt(b) + '):', 'head');
      this.line('    Area: ' + this.fmt(area), '');
      this.line('    Perimeter (approx): ' + this.fmt(pApprox), 'ok');
      this.line('    Eccentricity: ' + this.fmt(ecc), 'dim');
      this.line('    Focal distance: ' + this.fmt(fDist), 'dim');
    }, 'ellipse <a> <b>\n  Ellipse geometry (semi-axes a, b).\n  Example:  ellipse 5 3');

    // ======================== TORUS ========================
    this.reg('torus', args => {
      if (args.length < 2) { this.line('  Usage: torus <R> <r>', 'warn'); return; }
      const R = Math.abs(parseFloat(args[0])), r = Math.abs(parseFloat(args[1]));
      if (isNaN(R) || isNaN(r) || R === 0 || r === 0) { this.line('  Invalid.', 'err'); return; }
      this.line('  Torus (R=' + this.fmt(R) + ', r=' + this.fmt(r) + '):', 'head');
      this.line('    Surface Area: ' + this.fmt(4 * Math.PI * Math.PI * R * r), '');
      this.line('    Volume: ' + this.fmt(2 * Math.PI * Math.PI * R * r * r), 'ok');
      this.line('    Tube circumference: ' + this.fmt(2 * Math.PI * r), 'dim');
    }, 'torus <R> <r>\n  Torus geometry (R=major radius, r=minor radius).\n  Example:  torus 5 2');

    // ======================== POLYGON ========================
    this.reg('polygon', args => {
      if (args.length < 2) { this.line('  Usage: polygon <sides> <side_length>', 'warn'); return; }
      const n = parseInt(args[0]), s = parseFloat(args[1]);
      if (isNaN(n) || isNaN(s) || n < 3 || s <= 0) { this.line('  n ≥ 3, s > 0.', 'err'); return; }
      const apothem = s / (2 * Math.tan(Math.PI / n));
      const area = n * s * apothem / 2;
      const perimeter = n * s;
      const radius = s / (2 * Math.sin(Math.PI / n));
      this.line('  Regular ' + n + '-gon (side=' + this.fmt(s) + '):', 'head');
      this.line('    Area: ' + this.fmt(area), 'ok');
      this.line('    Perimeter: ' + this.fmt(perimeter), '');
      this.line('    Apothem: ' + this.fmt(apothem), 'dim');
      this.line('    Circumradius: ' + this.fmt(radius), 'dim');
      this.line('    Interior angle: ' + this.fmt((n - 2) * 180 / n) + String.fromCharCode(0x00B0), 'dim');
    }, 'polygon <sides> <side_length>\n  Regular polygon geometry (n ≥ 3).\n  Example:  polygon 6 2');

    // ======================== SHOELACE ========================
    this.reg('shoelace', args => {
      if (args.length < 6) { this.line('  Usage: shoelace <x1,y1> <x2,y2> ...', 'warn'); return; }
      const pts = []; args.forEach(a => { const m = a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/); if (m) pts.push([parseFloat(m[1]), parseFloat(m[2])]); });
      if (pts.length < 3) { this.line('  Need at least 3 points.', 'err'); return; }
      let sum1 = 0, sum2 = 0; const n = pts.length;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; sum1 += pts[i][0] * pts[j][1]; sum2 += pts[j][0] * pts[i][1]; }
      const area = Math.abs(sum1 - sum2) / 2;
      this.line('  Polygon area (shoelace, n=' + n + '): ' + this.fmt(area), 'ok');
    }, 'shoelace <points...>\n  Polygon area via shoelace formula.\n  Example:  shoelace 0,0 4,0 4,3');

    // ======================== DISTANCE ========================
    this.reg('distance', args => {
      if (args.length < 2) { this.line('  Usage: distance <x1,y1> <x2,y2>', 'warn'); return; }
      const pts = []; args.forEach(a => { const m = a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/); if (m) pts.push([parseFloat(m[1]), parseFloat(m[2])]); });
      if (pts.length < 2) { this.line('  Need 2 points.', 'err'); return; }
      const [[x1, y1], [x2, y2]] = pts;
      const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      this.line('  Distance = ' + this.fmt(d), 'ok');
      this.line('  Midpoint = (' + this.fmt((x1 + x2) / 2) + ', ' + this.fmt((y1 + y2) / 2) + ')', 'dim');
    }, 'distance <x1,y1> <x2,y2>\n  Euclidean distance between two points.\n  Example:  distance 0,0 3,4  ->  5');

    // ======================== LINE ========================
    this.reg('line', args => {
      if (args.length < 2) { this.line('  Usage: line <x1,y1> <x2,y2>', 'warn'); return; }
      const pts = []; args.forEach(a => { const m = a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/); if (m) pts.push([parseFloat(m[1]), parseFloat(m[2])]); });
      if (pts.length < 2) { this.line('  Need 2 points.', 'err'); return; }
      const [[x1, y1], [x2, y2]] = pts;
      const dx = x2 - x1, dy = y2 - y1;
      if (Math.abs(dx) < 1e-15) { this.line('  x = ' + this.fmt(x1) + '  (vertical line)', 'ok'); return; }
      const m = dy / dx;
      const c = y1 - m * x1;
      this.line('  y = ' + this.fmt(m) + 'x + ' + this.fmt(c), 'ok');
      this.line('  Slope: ' + this.fmt(m) + '  |  y-intercept: ' + this.fmt(c), 'dim');
      this.line('  Distance: ' + this.fmt(Math.sqrt(dx * dx + dy * dy)), 'dim');
    }, 'line <x1,y1> <x2,y2>\n  Line equation from two points.\n  Example:  line 1,2 3,6  ->  y = 2x');

    // ======================== ERF ========================
    this.reg('erf', args => {
      if (args.length === 0) { this.line('  Usage: erf <x>', 'warn'); return; }
      const x = parseFloat(args[0]); if (isNaN(x)) { this.line('  Invalid.', 'err'); return; }
      const result = this._erf(x);
      const erfc = 1 - result;
      this.line('  erf(' + this.fmt(x) + ') = ' + this.fmt(result), 'ok');
      this.line('  erfc(' + this.fmt(x) + ') = ' + this.fmt(erfc), 'dim');
    }, 'erf <x>\n  Error function erf(x) and complementary erfc(x).\n  Example:  erf 1');

    // ======================== BETA ========================
    this.reg('beta', args => {
      if (args.length < 2) { this.line('  Usage: beta <a> <b>', 'warn'); return; }
      const a = parseFloat(args[0]), b = parseFloat(args[1]);
      if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) { this.line('  a, b > 0.', 'err'); return; }
      const result = this._gamma(a) * this._gamma(b) / this._gamma(a + b);
      this.line('  B(' + this.fmt(a) + ', ' + this.fmt(b) + ') = ' + this.fmt(result), 'ok');
      if (a > 0 && b > 0) this.line('  Mean = ' + this.fmt(a / (a + b)) + '  |  Mode = ' + this.fmt(a > 1 && b > 1 ? (a - 1) / (a + b - 2) : 'N/A'), 'dim');
    }, 'beta <a> <b>\n  Beta function B(a,b).\n  Example:  beta 2 3');

    // ======================== ZETA ========================
    this.reg('zeta', args => {
      if (args.length === 0) { this.line('  Usage: zeta <s> [terms]', 'warn'); return; }
      const s = parseFloat(args[0]); const n = Math.min(100000, Math.max(1000, parseInt(args[1]) || 10000));
      if (isNaN(s) || s <= 1) { this.line('  s must be > 1 for convergence.', 'err'); return; }
      let sum = 0;
      for (let i = 1; i <= n; i++) { const t = 1 / Math.pow(i, s); sum += t; if (t < 1e-15) break; }
      this.line('  ' + String.fromCharCode(0x03B6) + '(' + this.fmt(s) + ') ' + String.fromCharCode(0x2248) + ' ' + this.fmt(sum), 'ok');
      this.line('  (' + n + ' terms)  |  error ' + String.fromCharCode(0x2248) + ' ' + this.fmt(1 / ((s - 1) * Math.pow(n + 1, s - 1))), 'dim');
    }, 'zeta <s> [terms]\n  Riemann zeta function ζ(s) for s > 1.\n  Example:  zeta 2  ->  ~π²/6 ≈ 1.64493');

    // ======================== LAMBERTW ========================
    this.reg('lambertw', args => {
      if (args.length === 0) { this.line('  Usage: lambertw <x>', 'warn'); return; }
      const x = parseFloat(args[0]); if (isNaN(x)) { this.line('  Invalid.', 'err'); return; }
      // Halley iteration for Lambert W
      let w = x >= 0 ? 1 : -0.5;
      for (let i = 0; i < 100; i++) {
        const ew = Math.exp(w), wew = w * ew, dwp = ew * (w + 1);
        if (Math.abs(dwp) < 1e-15) break;
        const delta = (wew - x) / (dwp - (w + 2) * (wew - x) / (2 * (w + 1)));
        w -= delta;
        if (Math.abs(delta) < 1e-14) break;
      }
      this.line('  W' + String.fromCharCode(0x2080) + '(' + this.fmt(x) + ') ' + String.fromCharCode(0x2248) + ' ' + this.fmt(w), 'ok');
      this.line('  Check: ' + this.fmt(w) + ' × exp(' + this.fmt(w) + ') = ' + this.fmt(w * Math.exp(w)), 'dim');
    }, 'lambertw <x>\n  Lambert W function (principal branch).\n  Example:  lambertw 1  ->  ~0.5671');

    // ======================== LEGENDRE ========================
    this.reg('legendre', args => {
      if (args.length < 2) { this.line('  Usage: legendre <n> <x>', 'warn'); return; }
      const n = parseInt(args[0]), x = parseFloat(args[1]);
      if (isNaN(n) || isNaN(x) || n < 0 || n > 20) { this.line('  0 ≤ n ≤ 20.', 'err'); return; }
      // Bonnet's recurrence
      let p0 = 1, p1 = x;
      if (n === 0) { this.line('  P' + String.fromCharCode(0x2080) + '(' + this.fmt(x) + ') = 1', 'ok'); return; }
      if (n === 1) { this.line('  P' + String.fromCharCode(0x2081) + '(' + this.fmt(x) + ') = ' + this.fmt(x), 'ok'); return; }
      let pk;
      for (let k = 2; k <= n; k++) { pk = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = pk; }
      this.line('  P' + String.fromCharCode(0x2099) + '(' + this.fmt(x) + ') = P' + String.fromCharCode(0x2099) + '(' + this.fmt(x) + ') = ' + this.fmt(pk), 'ok');
    }, 'legendre <n> <x>\n  Legendre polynomial Pₙ(x) (n ≤ 20).\n  Example:  legendre 3 0.5');

    // ======================== FV ========================
    this.reg('fv', args => {
      if (args.length < 4) { this.line('  Usage: fv <rate> <nper> <pmt> <pv>', 'warn'); return; }
      const [rate, nper, pmt, pv] = args.map(parseFloat);
      if ([rate, nper, pmt, pv].some(v => isNaN(v))) { this.line('  Invalid.', 'err'); return; }
      const r = rate / 100;
      const fv = -pmt * (Math.pow(1 + r, nper) - 1) / r - pv * Math.pow(1 + r, nper);
      this.line('  Future Value: ' + this.fmt(fv), 'ok');
      this.line('  Rate: ' + this.fmt(rate) + '%  |  Nper: ' + nper + '  |  PMT: ' + this.fmt(pmt) + '  |  PV: ' + this.fmt(pv), 'dim');
      this.line('  Total interest: ' + this.fmt(Math.abs(fv) - Math.abs(pv) - Math.abs(pmt) * nper * (pmt < 0 ? -1 : 1)), 'dim');
    }, 'fv <rate%> <nper> <pmt> <pv>\n  Future value of an annuity.\n  Example:  fv 5 10 -100 -1000');

    // ======================== PV ========================
    this.reg('pv', args => {
      if (args.length < 4) { this.line('  Usage: pv <rate> <nper> <pmt> <fv>', 'warn'); return; }
      const [rate, nper, pmt, fv] = args.map(parseFloat);
      if ([rate, nper, pmt, fv].some(v => isNaN(v))) { this.line('  Invalid.', 'err'); return; }
      const r = rate / 100;
      const pv = -(fv + pmt * (Math.pow(1 + r, nper) - 1) / r) / Math.pow(1 + r, nper);
      this.line('  Present Value: ' + this.fmt(pv), 'ok');
    }, 'pv <rate%> <nper> <pmt> <fv>\n  Present value of an annuity.\n  Example:  pv 5 10 -100 0');

    // ======================== PMT ========================
    this.reg('pmt', args => {
      if (args.length < 4) { this.line('  Usage: pmt <rate> <nper> <pv> <fv>', 'warn'); return; }
      const [rate, nper, pv, fv] = args.map(parseFloat);
      if ([rate, nper, pv, fv].some(v => isNaN(v))) { this.line('  Invalid.', 'err'); return; }
      const r = rate / 100;
      const pmt = -(pv * Math.pow(1 + r, nper) + fv) * r / (Math.pow(1 + r, nper) - 1);
      this.line('  Payment: ' + this.fmt(pmt), 'ok');
    }, 'pmt <rate%> <nper> <pv> <fv>\n  Payment for an annuity.\n  Example:  pmt 5 10 -1000 0');

    // ======================== NPV ========================
    this.reg('npv', args => {
      if (args.length < 3) { this.line('  Usage: npv <rate> <values...>', 'warn'); return; }
      const rate = parseFloat(args[0]); if (isNaN(rate)) { this.line('  Invalid rate.', 'err'); return; }
      const vals = args.slice(1).map(parseFloat).filter(v => isFinite(v));
      if (vals.length < 1) { this.line('  Need at least 1 cash flow.', 'err'); return; }
      const r = rate / 100;
      let npv = vals[0];
      for (let i = 1; i < vals.length; i++) npv += vals[i] / Math.pow(1 + r, i);
      this.line('  NPV at ' + rate + '% = ' + this.fmt(npv), 'ok');
      this.line('  Cash flows: [' + vals.join(', ') + ']', 'dim');
    }, 'npv <rate%> <values...>\n  Net present value.\n  Example:  npv 10 -1000 300 400 500 600');

    // ======================== IRR ========================
    this.reg('irr', args => {
      if (args.length < 2) { this.line('  Usage: irr <values...>', 'warn'); return; }
      const vals = args.map(parseFloat).filter(v => isFinite(v));
      if (vals.length < 2) { this.line('  Need at least 2 cash flows.', 'err'); return; }
      if (vals[0] >= 0) { this.line('  First cash flow should be negative (investment).', 'warn'); }
      const npvFn = (r) => { let s = vals[0]; for (let i = 1; i < vals.length; i++) s += vals[i] / Math.pow(1 + r, i); return s; };
      let lo = -0.99, hi = 10;
      for (let i = 0; i < 100; i++) {
        const m = (lo + hi) / 2;
        const f = npvFn(m);
        if (Math.abs(f) < 1e-10) { lo = m; break; }
        if (npvFn(lo) * f > 0) lo = m; else hi = m;
        if (hi - lo < 1e-12) break;
      }
      this.line('  IRR = ' + this.fmt(lo * 100) + '%', 'ok');
      this.line('  NPV at IRR ' + String.fromCharCode(0x2248) + ' ' + this.fmt(npvFn(lo)), 'dim');
    }, 'irr <values...>\n  Internal rate of return.\n  Example:  irr -1000 300 400 500 600');

    // ======================== CATALAN ========================
    this.reg('catalan', args => {
      if (args.length === 0) { this.line('  Usage: catalan <n>', 'warn'); return; }
      const n = Math.min(33, Math.max(0, parseInt(args[0])));
      if (isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      const seq = []; let c = 1;
      for (let i = 0; i <= n; i++) { seq.push(c); c = c * 2 * (2 * i + 1) / (i + 2); }
      this.line('  Catalan numbers C' + String.fromCharCode(0x2080) + ' to C' + String.fromCharCode(0x2099) + ':', 'head');
      const chunks = []; for (let i = 0; i < seq.length; i += 6) chunks.push(seq.slice(i, i + 6).map((v, j) => 'C_' + (i + j) + '=' + v).join('  '));
      chunks.forEach(c => this.line('    ' + c, ''));
    }, 'catalan <n>\n  Catalan numbers (C₀ to Cₙ).\n  Example:  catalan 10');

    // ======================== BELL ========================
    this.reg('bell', args => {
      if (args.length === 0) { this.line('  Usage: bell <n>', 'warn'); return; }
      const n = Math.min(20, Math.max(0, parseInt(args[0])));
      if (isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      const bell = Array(n + 1).fill(0); bell[0] = 1;
      for (let i = 1; i <= n; i++) { let s = 0; for (let k = 0; k < i; k++) s += this._comb(i - 1, k) * bell[k]; bell[i] = s; }
      const seq = bell;
      this.line('  Bell numbers B' + String.fromCharCode(0x2080) + ' to B' + String.fromCharCode(0x2099) + ':', 'head');
      const chunks = []; for (let i = 0; i < seq.length; i += 5) chunks.push(seq.slice(i, i + 5).map((v, j) => 'B_' + (i + j) + '=' + v.toLocaleString()).join('  '));
      chunks.forEach(c => this.line('    ' + c, ''));
    }, 'bell <n>\n  Bell numbers (B₀ to Bₙ, n ≤ 20).\n  Example:  bell 10');

    // ======================== STIRLING ========================
    this.reg('stirling', args => {
      if (args.length < 2) { this.line('  Usage: stirling <n> <k>', 'warn'); return; }
      const n = parseInt(args[0]), k = parseInt(args[1]);
      if (isNaN(n) || isNaN(k) || n < 0 || k < 0 || k > n) { this.line('  0 ≤ k ≤ n.', 'err'); return; }
      const S = Array.from({ length: n + 1 }, () => Array(k + 1).fill(0)); S[0][0] = 1;
      for (let i = 1; i <= n; i++) for (let j = 1; j <= Math.min(i, k); j++) S[i][j] = S[i - 1][j - 1] + j * S[i - 1][j];
      this.line('  S(' + n + ', ' + k + ') = ' + S[n][k].toLocaleString(), 'ok');
      if (k === n || k === 1 || k === n - 1) this.line('  (Special case)', 'dim');
    }, 'stirling <n> <k>\n  Stirling numbers of the second kind S(n,k).\n  Example:  stirling 5 2  ->  15');

    // ======================== DERANGE ========================
    this.reg('derange', args => {
      if (args.length === 0) { this.line('  Usage: derange <n>', 'warn'); return; }
      const n = Math.min(20, Math.max(0, parseInt(args[0])));
      if (isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      let d = 1, seq = [1];
      for (let i = 2; i <= n; i++) { d = (i - 1) * (d + (i > 2 ? seq[seq.length - 1] : 0)); seq.push(d); }
      const der = [1, 0]; for (let i = 2; i <= n; i++) der.push((i - 1) * (der[i - 1] + der[i - 2]));
      this.line('  !' + n + ' (derangements) = ' + der[n].toLocaleString(), 'ok');
      this.line('  !n / n! = ' + this.fmt(der[n] / this._factorial(n)) + '  ' + String.fromCharCode(0x2248) + ' 1/e', 'dim');
      if (n <= 10) { this.line('  Sequence: ' + der.join(', '), 'dim'); }
    }, 'derange <n>\n  Derangements (!n, subfactorial).\n  Example:  derange 5  ->  44');

    // ======================== PADOVAN ========================
    this.reg('padovan', args => {
      if (args.length === 0) { this.line('  Usage: padovan <n>', 'warn'); return; }
      const n = Math.min(50, Math.max(1, parseInt(args[0]) || 10));
      if (isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      const seq = [1, 1, 1];
      for (let i = 3; i <= n; i++) seq.push(seq[i - 2] + seq[i - 3]);
      this.line('  Padovan sequence (' + n + ' terms):', 'head');
      const chunks = []; for (let i = 0; i < seq.length; i += 10) chunks.push(seq.slice(i, i + 10).join(', '));
      chunks.forEach(c => this.line('    ' + c, ''));
      this.line('  P(' + n + ') = ' + seq[n - 1], 'ok');
    }, 'padovan <n>\n  Padovan sequence (P₀ = P₁ = P₂ = 1).\n  Example:  padovan 20');

    // ======================== LOGB ========================
    this.reg('logb', args => {
      if (args.length < 2) { this.line('  Usage: logb <x> <base>', 'warn'); return; }
      const x = parseFloat(args[0]), base = parseFloat(args[1]);
      if (isNaN(x) || isNaN(base) || x <= 0 || base <= 0 || base === 1) { this.line('  x > 0, base > 0, base ≠ 1.', 'err'); return; }
      const result = Math.log(x) / Math.log(base);
      this.line('  log_' + this.fmt(base) + '(' + this.fmt(x) + ') = ' + this.fmt(result), 'ok');
    }, 'logb <x> <base>\n  Logarithm with arbitrary base.\n  Example:  logb 8 2  ->  3');

    // ======================== ROUND ========================
    this.reg('round', args => {
      if (args.length === 0) { this.line('  Usage: round <n> [decimals]', 'warn'); return; }
      const n = parseFloat(args[0]); const d = Math.min(15, Math.max(0, parseInt(args[1]) || 0));
      if (isNaN(n) || isNaN(d)) { this.line('  Invalid.', 'err'); return; }
      const f = Math.pow(10, d);
      this.line('  round(' + this.fmt(n) + ', ' + d + ') = ' + this.fmt(Math.round(n * f) / f), 'ok');
      this.line('  floor: ' + this.fmt(Math.floor(n * f) / f) + '  |  ceil: ' + this.fmt(Math.ceil(n * f) / f), 'dim');
    }, 'round <n> [decimals]\n  Round, floor, and ceil.\n  Example:  round 3.14159 2');

    // ======================== CLAMP ========================
    this.reg('clamp', args => {
      if (args.length < 3) { this.line('  Usage: clamp <n> <min> <max>', 'warn'); return; }
      const [n, lo, hi] = args.map(parseFloat);
      if ([n, lo, hi].some(v => isNaN(v))) { this.line('  Invalid.', 'err'); return; }
      const result = Math.max(lo, Math.min(hi, n));
      this.line('  clamp(' + this.fmt(n) + ', ' + this.fmt(lo) + ', ' + this.fmt(hi) + ') = ' + this.fmt(result), 'ok');
      if (n < lo) this.line('  (clamped to lower bound)', 'dim');
      else if (n > hi) this.line('  (clamped to upper bound)', 'dim');
      else this.line('  (in range)', 'dim');
    }, 'clamp <n> <min> <max>\n  Clamp a value between min and max.\n  Example:  clamp 15 0 10  ->  10');

    // ======================== LERP ========================
    this.reg('lerp', args => {
      if (args.length < 3) { this.line('  Usage: lerp <a> <b> <t>', 'warn'); return; }
      const [a, b, t] = args.map(parseFloat);
      if ([a, b, t].some(v => isNaN(v))) { this.line('  Invalid.', 'err'); return; }
      const result = a + (b - a) * t;
      this.line('  lerp(' + this.fmt(a) + ', ' + this.fmt(b) + ', ' + this.fmt(t) + ') = ' + this.fmt(result), 'ok');
    }, 'lerp <a> <b> <t>\n  Linear interpolation: a + (b-a)*t.\n  Example:  lerp 0 10 0.5  ->  5');

    // ======================== PERCENT ========================
    this.reg('percent', args => {
      if (args.length < 2) { this.line('  Usage: percent <value> <total>', 'warn'); return; }
      const [val, total] = args.map(parseFloat);
      if ([val, total].some(v => isNaN(v)) || total === 0) { this.line('  Invalid.', 'err'); return; }
      const pct = val / total * 100;
      const remains = total - val;
      this.line('  ' + this.fmt(val) + ' / ' + this.fmt(total) + ' = ' + this.fmt(pct) + '%', 'ok');
      this.line('  Remaining: ' + this.fmt(remains) + ' (' + this.fmt(remains / total * 100) + '%)', 'dim');
    }, 'percent <value> <total>\n  Percentage calculation.\n  Example:  percent 25 200  ->  12.5%');

    // ======================== MOD ========================
    this.reg('mod', args => {
      if (args.length < 2) { this.line('  Usage: mod <a> <b>', 'warn'); return; }
      const a = parseFloat(args[0]), b = parseFloat(args[1]);
      if (isNaN(a) || isNaN(b) || b === 0) { this.line('  Invalid. b ≠ 0.', 'err'); return; }
      const r = ((a % b) + b) % b;
      this.line('  ' + this.fmt(a) + ' mod ' + this.fmt(b) + ' = ' + this.fmt(r), 'ok');
      this.line('  Quotient: ' + Math.floor(a / b) + '  |  Remainder: ' + r, 'dim');
    }, 'mod <a> <b>\n  Proper modulo (always non-negative).\n  Example:  mod -7 3  ->  2');

    // ======================== MOVING ========================
    this.reg('moving', args => {
      if (args.length < 3) { this.line('  Usage: moving <numbers...> <window>', 'warn'); return; }
      const windowSize = Math.max(2, Math.min(100, parseInt(args[args.length - 1]) || 3));
      const data = args.slice(0, -1).map(parseFloat).filter(v => isFinite(v));
      if (data.length < windowSize) { this.line('  Not enough data points.', 'err'); return; }
      const result = [];
      for (let i = 0; i <= data.length - windowSize; i++) { let sum = 0; for (let j = 0; j < windowSize; j++) sum += data[i + j]; result.push(sum / windowSize); }
      this.line('  Moving Average (window=' + windowSize + ', n=' + data.length + '):', 'head');
      const chunks = []; for (let i = 0; i < result.length; i += 10) chunks.push(result.slice(i, i + 10).map(v => this.fmt(v)).join(', '));
      chunks.forEach(c => this.line('    ' + c, ''));
      this.line('  Last MA: ' + this.fmt(result[result.length - 1]), 'ok');
    }, 'moving <numbers...> <window>\n  Simple moving average.\n  Example:  moving 1 2 3 4 5 6 7 8 3');

    // ======================== CONV ========================
    this.reg('conv', args => {
      if (args.length < 4) { this.line('  Usage: conv <signal...> <kernel...>', 'warn'); this.line('  Separate signal and kernel with "/"', 'dim'); return; }
      const splitIdx = args.indexOf('/');
      if (splitIdx < 0) { this.line('  Separate signal and kernel with "/"', 'warn'); return; }
      const signal = args.slice(0, splitIdx).map(parseFloat).filter(v => isFinite(v));
      const kernel = args.slice(splitIdx + 1).map(parseFloat).filter(v => isFinite(v));
      if (signal.length === 0 || kernel.length === 0) { this.line('  Need signal and kernel.', 'err'); return; }
      const n = signal.length, m = kernel.length, result = Array(n + m - 1).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) result[i + j] += signal[i] * kernel[j];
      this.line('  1D Convolution (' + n + ' × ' + m + ' → ' + (n + m - 1) + '):', 'head');
      const chunks = []; for (let i = 0; i < result.length; i += 10) chunks.push(result.slice(i, i + 10).map(v => this.fmt(v)).join(', '));
      chunks.forEach(c => this.line('    ' + c, ''));
      this.line('  Sum: ' + this.fmt(result.reduce((s, v) => s + v, 0)), 'dim');
    }, 'conv <signal...> / <kernel...>\n  1D convolution. Separate arrays with "/".\n  Example:  conv 1 2 3 / 4 5');

    // ======================== GUESS (Game) ========================
    this.reg('guess', args => {
      if (args.length === 0 || args[0] === 'start' || args[0] === 'new') {
        this._gameState = { type:'guess', target:Math.floor(Math.random()*100)+1, attempts:0, min:1, max:100 };
        this.line('  Guess the Number (1-100)!  Use: guess <n>', 'em');
        this.line('  Also: guess hint  |  guess quit', 'dim'); return;
      }
      if (!this._gameState || this._gameState.type !== 'guess') {
        if (args[0] === 'quit') { this.line('  No game.', 'dim'); return; }
        this._gameState = { type:'guess', target:Math.floor(Math.random()*100)+1, attempts:0, min:1, max:100 };
        this.line('  (Auto-started new game)', 'dim');
      }
      if (args[0] === 'quit') { this.line('  The number was ' + this._gameState.target + '.', 'ok'); this._gameState = null; return; }
      if (args[0] === 'hint') { this.line('  Hint: ' + (this._gameState.target%2===0?'even':'odd') + ', ' + (this._gameState.target>50?'>50':'≤50'), 'hl'); return; }
      const g = parseInt(args[0]);
      if (isNaN(g)) { this.line('  Enter a number, hint, or quit.', 'warn'); return; }
      this._gameState.attempts++;
      if (g < this._gameState.target) { if (g > this._gameState.min) this._gameState.min = g + 1; this.line('  Too low! (' + this._gameState.min + '-' + this._gameState.max + ')', ''); }
      else if (g > this._gameState.target) { if (g < this._gameState.max) this._gameState.max = g - 1; this.line('  Too high! (' + this._gameState.min + '-' + this._gameState.max + ')', ''); }
      else { this.line('  Correct! ' + this._gameState.target + ' in ' + this._gameState.attempts + ' attempt' + (this._gameState.attempts>1?'s':'') + '!', 'ok');
        if (this._gameState.attempts <= 3) this.line('  Incredible!', 'em'); else if (this._gameState.attempts <= 7) this.line('  Well done!', 'hl'); this._gameState = null; }
    }, 'guess [n]\n  Number guessing game (1-100).\n  guess          start new game\n  guess 50       guess 50\n  guess hint     get a hint\n  guess quit     end game');

    // ======================== QUIZ (Game) ========================
    this.reg('quiz', args => {
      const genQ = (s) => {
        if (!s || s.answered) {
          const ops = ['+','-','*','/']; const op = ops[Math.floor(Math.random()*4)];
          let a = Math.floor(Math.random()*20)+1, b = Math.floor(Math.random()*20)+1, ans;
          if (op === '+') ans = a + b;
          else if (op === '-') { if (a < b) [a,b]=[b,a]; ans = a - b; }
          else if (op === '*') { a = Math.floor(Math.random()*12)+1; b = Math.floor(Math.random()*12)+1; ans = a * b; }
          else { b = Math.max(1, Math.floor(Math.random()*10)+1); a = b * (Math.floor(Math.random()*12)+1); ans = a / b; }
          return { a, b, op, answer:ans, answered:false, correct:false };
        }
        return s;
      };
      if (args.length === 0 || args[0] === 'start') {
        this._gameState = { type:'quiz', score:0, total:0, current:null, active:true };
        this._gameState.current = genQ(null);
        this.line('  Math Quiz! Type "quiz <answer>"', 'em');
        this.line('  Type: quiz next | quiz quit', 'dim');
        this.line('  Q' + (this._gameState.total+1) + ': ' + this._gameState.current.a + ' ' + this._gameState.current.op + ' ' + this._gameState.current.b + ' = ?', '');
        return;
      }
      if (!this._gameState || this._gameState.type !== 'quiz') { this.line('  No quiz. Type "quiz" to start.', 'warn'); return; }
      if (args[0] === 'quit') { this.line('  Final score: ' + this._gameState.score + '/' + this._gameState.total, 'ok'); this._gameState = null; return; }
      if (args[0] === 'next' || args[0] === 'skip') {
        this._gameState.current = genQ(null); this._gameState.total++;
        this.line('  Q' + (this._gameState.total+1) + ': ' + this._gameState.current.a + ' ' + this._gameState.current.op + ' ' + this._gameState.current.b + ' = ?', '');
        return;
      }
      if (!this._gameState.current || this._gameState.current.answered) {
        this.line('  Answer already given. Type "quiz next"', 'warn'); return;
      }
      const ans = parseFloat(args[0]);
      if (isNaN(ans)) { this.line('  Enter a number.', 'warn'); return; }
      this._gameState.current.answered = true;
      this._gameState.total++;
      const diff = Math.abs(ans - this._gameState.current.answer);
      if (diff < 0.01) { this._gameState.score++; this.line('  Correct! (+1)', 'ok'); }
      else if (diff < 0.5) { this._gameState.score += 0.5; this.line('  Close enough! (answer: ' + this.fmt(this._gameState.current.answer) + ', +0.5)', 'hl'); }
      else { this.line('  Wrong! Answer was ' + this.fmt(this._gameState.current.answer), 'err'); }
      this.line('  Score: ' + this._gameState.score + '/' + this._gameState.total, '');
      this.line('  Type "quiz next" for next question, "quiz quit" to end.', 'dim');
    }, 'quiz [answer]\n  Math quiz game.\n  quiz          start\n  quiz 42       answer current question\n  quiz next     next question\n  quiz quit     end');

    // ======================== TTT (Game) ========================
    this.reg('ttt', args => {
      const showBoard = (b) => {
        this.br();
        this.line('    0   1   2', 'dim');
        for (let r = 0; r < 3; r++) {
          let row = r + '  ';
          for (let c = 0; c < 3; c++) row += ' ' + (b[r][c]||'.') + (c<2?' │':'');
          this.line(row, '');
          if (r < 2) this.line('   ───┼───┼───', 'dim');
        }
        this.br();
      };
      const checkWin = (b) => {
        for (let r = 0; r < 3; r++) { if (b[r][0] && b[r][0] === b[r][1] && b[r][1] === b[r][2]) return b[r][0]; }
        for (let c = 0; c < 3; c++) { if (b[0][c] && b[0][c] === b[1][c] && b[1][c] === b[2][c]) return b[0][c]; }
        if (b[0][0] && b[0][0] === b[1][1] && b[1][1] === b[2][2]) return b[0][0];
        if (b[0][2] && b[0][2] === b[1][1] && b[1][1] === b[2][0]) return b[0][2];
        if (b.every(r => r.every(c => c))) return 'tie';
        return null;
      };
      const aiMove = (b) => {
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { if (!b[r][c]) { b[r][c] = 'O'; if (checkWin(b) === 'O') { b[r][c] = null; return [r,c]; } b[r][c] = null; } }
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { if (!b[r][c]) { b[r][c] = 'X'; if (checkWin(b) === 'X') { b[r][c] = null; return [r,c]; } b[r][c] = null; } }
        const corners = [[0,0],[0,2],[2,0],[2,2]].filter(([r,c]) => !b[r][c]);
        if (corners.length > 0) return corners[Math.floor(Math.random()*corners.length)];
        const edges = [[0,1],[1,0],[1,2],[2,1]].filter(([r,c]) => !b[r][c]);
        if (edges.length > 0) return edges[Math.floor(Math.random()*edges.length)];
        if (!b[1][1]) return [1,1];
        return null;
      };
      if (args.length === 0 || args[0] === 'start') {
        this._gameState = { type:'ttt', board:[Array(3),Array(3),Array(3)], turn:'X', over:false };
        this.line('  Tic-Tac-Toe (you = X, AI = O)', 'em');
        this.line('  Use: ttt <row> <col>  (0-2, 0-2)', 'dim');
        showBoard(this._gameState.board); return;
      }
      if (!this._gameState || this._gameState.type !== 'ttt') { this.line('  No game. Type "ttt" to start.', 'warn'); return; }
      if (args[0] === 'quit' || args[0] === 'end') { this.line('  Game ended.', 'dim'); this._gameState = null; return; }
      if (this._gameState.over) { this.line('  Game over! Type "ttt" for new game.', 'warn'); return; }
      if (this._gameState.turn !== 'X') { this.line('  AI is thinking...', 'dim'); return; }
      const r = parseInt(args[0]), c = parseInt(args[1]);
      if (isNaN(r)||isNaN(c)||r<0||r>2||c<0||c>2) { this.line('  Row and col must be 0-2.', 'warn'); return; }
      if (this._gameState.board[r][c]) { this.line('  Cell taken!', 'warn'); return; }
      this._gameState.board[r][c] = 'X';
      let winner = checkWin(this._gameState.board);
      if (winner) {
        showBoard(this._gameState.board);
        if (winner === 'X') this.line('  You win!', 'ok');
        else if (winner === 'tie') this.line('  Tie!', 'hl');
        this._gameState.over = true; return;
      }
      this._gameState.turn = 'O';
      const mv = aiMove(this._gameState.board);
      if (mv) { this._gameState.board[mv[0]][mv[1]] = 'O'; }
      this._gameState.turn = 'X';
      winner = checkWin(this._gameState.board);
      showBoard(this._gameState.board);
      if (winner === 'O') { this.line('  AI wins!', 'err'); this._gameState.over = true; }
      else if (winner === 'tie') { this.line('  Tie!', 'hl'); this._gameState.over = true; }
      else { this.line('  Your turn (X): ttt <row> <col>', 'dim'); }
    }, 'ttt [row col]\n  Tic-Tac-Toe vs AI.\n  ttt           start game\n  ttt 0 0       place X at row 0, col 0\n  ttt quit      end game');

    // ======================== HANGMAN (Game) ========================
    this.reg('hangman', args => {
      const words = ['ALGORITHM','FRACTAL','INTEGRAL','MATRIX','VECTOR','PRIME','FIBONACCI','GEOMETRY','CALCULUS','LOGARITHM','POLYNOMIAL','PROBABILITY','SYMMETRY','DERIVATIVE','TENSOR','EIGENVALUE','TOPOLOGY','MANIFOLD','ENTROPY','DIFFRACTION','HYPOTHESIS','PARADOX','INFINITY','CHAOS','BIFURCATION','CATALAN','STIRLING','GAUSSIAN','LAPLACIAN','HAMILTONIAN'];
      const stages = ['  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========','  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========','  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========','  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========','  +---+\n  |   |\n  O   |\n /|\\\\  |\n      |\n      |\n=========','  +---+\n  |   |\n  O   |\n /|\\\\  |\n /    |\n      |\n=========','  +---+\n  |   |\n  O   |\n /|\\\\  |\n / \\\\  |\n      |\n========='];
      if (args.length === 0 || args[0] === 'start') {
        const word = words[Math.floor(Math.random()*words.length)];
        this._gameState = { type:'hangman', word, guessed:[], wrong:0, maxWrong:6 };
        this.line('  Math Hangman! Guess the math word.', 'em');
        this.line('  Use: hangman <letter>  |  hangman quit', 'dim'); this.br();
        this.line(stages[0], '');
        this.line('  ' + word.split('').map(l => '_').join(' '), '');
        this.line('  Wrong: ' + this._gameState.wrong + '/' + this._gameState.maxWrong, 'dim');
        return;
      }
      if (!this._gameState || this._gameState.type !== 'hangman') { this.line('  No game. Type "hangman" to start.', 'warn'); return; }
      if (args[0] === 'quit') { this.line('  The word was: ' + this._gameState.word, 'ok'); this._gameState = null; return; }
      if (args[0] === 'show') { this.line('  Word: ' + this._gameState.word, 'hl'); return; }
      const letter = args[0].toUpperCase();
      if (letter.length !== 1 || !letter.match(/[A-Z]/)) { this.line('  Enter a single letter A-Z.', 'warn'); return; }
      if (this._gameState.guessed.includes(letter)) { this.line('  Already guessed: ' + letter, 'dim'); return; }
      this._gameState.guessed.push(letter);
      if (this._gameState.word.includes(letter)) {
        this.line('  Yes! ' + letter + ' is in the word!', 'ok');
      } else {
        this._gameState.wrong++;
        this.line('  No, ' + letter + ' is not in the word.', 'err');
      }
      const display = this._gameState.word.split('').map(l => this._gameState.guessed.includes(l) ? l : '_').join(' ');
      this.br(); this.line(stages[this._gameState.wrong], '');
      this.line('  ' + display, '');
      this.line('  Guessed: ' + this._gameState.guessed.join(', '), 'dim');
      this.line('  Wrong: ' + this._gameState.wrong + '/' + this._gameState.maxWrong, 'dim');
      if (this._gameState.wrong >= this._gameState.maxWrong) {
        this.line('  Game over! The word was: ' + this._gameState.word, 'err');
        this._gameState = null; return;
      }
      if (!display.includes('_')) {
        this.line('  You got it! The word was ' + this._gameState.word + '!', 'ok');
        this._gameState = null;
      }
    }, 'hangman [letter]\n  Math-themed hangman word game.\n  hangman          start new game\n  hangman A        guess letter A\n  hangman quit     show answer');

    // ======================== HANOI (Game) ========================
    this.reg('hanoi', args => {
      const showPegs = (pegs) => {
        this.br(); const n = Math.max(...pegs.map(p => p.length), 0);
        for (let row = n - 1; row >= 0; row--) {
          let line = '  ';
          for (let p = 0; p < 3; p++) {
            const d = pegs[p][row] || 0;
            const pad = 8, disk = d > 0 ? String.fromCharCode(0x2588).repeat(Math.min(d, 7)) : '|';
            line += disk.padStart(Math.round(pad/2)+Math.min(d,7)/2).padEnd(pad);
          }
          this.line(line, '');
        }
        this.line('  ' + '='.repeat(24), 'dim');
        this.line('    A' + ' '.repeat(7) + 'B' + ' '.repeat(7) + 'C', 'em');
        this.br();
      };
      if (args.length === 0 || args[0] === 'start') {
        const n = args[0] === 'start' && parseInt(args[1]) ? Math.min(8, Math.max(2, parseInt(args[1]))) : 3;
        const pegs = [Array.from({length:n}, (_,i) => n - i), [], []];
        this._gameState = { type:'hanoi', pegs, disks:n, moves:0 };
        this.line('  Tower of Hanoi (' + n + ' disks)', 'em');
        this.line('  Move: hanoi <from> <to>  (A, B, or C)', 'dim');
        this.line('  Goal: move all disks from A to C', 'dim');
        showPegs(pegs); return;
      }
      if (!this._gameState || this._gameState.type !== 'hanoi') { this.line('  No game. Type "hanoi" to start.', 'warn'); return; }
      if (args[0] === 'quit') { this.line('  Game ended. ' + this._gameState.moves + ' moves.', 'dim'); this._gameState = null; return; }
      const pegMap = { 'a':0, 'b':1, 'c':2, 'A':0, 'B':1, 'C':2 };
      const from = pegMap[args[0]], to = pegMap[args[1]];
      if (from === undefined || to === undefined) { this.line('  Use: hanoi A B  (A→B)', 'warn'); return; }
      if (from === to) { this.line('  Same peg.', 'warn'); return; }
      const pegs = this._gameState.pegs;
      if (pegs[from].length === 0) { this.line('  No disk on peg ' + args[0].toUpperCase(), 'warn'); return; }
      const disk = pegs[from][pegs[from].length - 1];
      if (pegs[to].length > 0 && pegs[to][pegs[to].length - 1] < disk) { this.line('  Cannot place larger disk on smaller one!', 'err'); return; }
      pegs[from].pop(); pegs[to].push(disk);
      this._gameState.moves++;
      showPegs(pegs);
      this.line('  Moved disk from ' + args[0].toUpperCase() + ' to ' + args[1].toUpperCase() + '  |  Moves: ' + this._gameState.moves, '');
      if (pegs[2].length === this._gameState.disks) {
        const minMoves = Math.pow(2, this._gameState.disks) - 1;
        this.line('  Solved in ' + this._gameState.moves + ' moves! (optimal: ' + minMoves + ')', 'ok');
        if (this._gameState.moves === minMoves) this.line('  Perfect! Optimal solution!', 'em');
        this._gameState = null;
      }
    }, 'hanoi [start [n]]\n  Tower of Hanoi puzzle.\n  hanoi start 4   start with 4 disks\n  hanoi A C        move top disk from A to C\n  hanoi quit       end');

    // ======================== MASTERMIND (Game) ========================
    this.reg('mastermind', args => {
      if (args.length === 0 || args[0] === 'start') {
        const secret = Array.from({length:4}, () => Math.floor(Math.random()*6)+1).join('');
        this._gameState = { type:'mastermind', secret, rounds:0, history:[] };
        this.line('  Mastermind! Guess 4 digits (1-6).', 'em');
        this.line('  Use: mastermind <1234>  |  mastermind quit', 'dim');
        this.line('  * = correct digit & position  |  o = correct digit, wrong position', 'dim'); this.br();
        return;
      }
      if (!this._gameState || this._gameState.type !== 'mastermind') { this.line('  No game. Type "mastermind" to start.', 'warn'); return; }
      if (args[0] === 'quit') { this.line('  The secret was: ' + this._gameState.secret, 'ok'); this._gameState = null; return; }
      const guess = args[0].replace(/[^1-6]/g,'');
      if (guess.length !== 4) { this.line('  Enter 4 digits (1-6), e.g., mastermind 1234', 'warn'); return; }
      this._gameState.rounds++;
      const sec = this._gameState.secret;
      let exact = 0, partial = 0;
      const secArr = sec.split(''), gArr = guess.split('');
      const secUsed = [false,false,false,false], gUsed = [false,false,false,false];
      for (let i = 0; i < 4; i++) { if (gArr[i] === secArr[i]) { exact++; secUsed[i] = gUsed[i] = true; } }
      for (let i = 0; i < 4; i++) { if (gUsed[i]) continue;
        for (let j = 0; j < 4; j++) { if (secUsed[j] || gArr[i] !== secArr[j]) continue; partial++; secUsed[j] = gUsed[i] = true; break; } }
      const dots = String.fromCharCode(0x25CF).repeat(exact) + String.fromCharCode(0x25CB).repeat(partial) + ' '.repeat(4-exact-partial);
      this.line('  ' + guess.split('').join(' ') + '  ' + dots + '  (round ' + this._gameState.rounds + ')', '');
      if (exact === 4) {
        this.line('  Solved in ' + this._gameState.rounds + ' rounds!', 'ok');
        if (this._gameState.rounds <= 4) this.line('  Genius!', 'em');
        else if (this._gameState.rounds <= 7) this.line('  Great!', 'hl');
        this._gameState = null;
      }
      if (this._gameState && this._gameState.rounds >= 12) {
        this.line('  Out of rounds. The secret was: ' + this._gameState.secret, 'err');
        this._gameState = null;
      }
    }, 'mastermind [guess]\n  Code-breaking game (4 digits, 1-6).\n  mastermind           start\n  mastermind 1234      guess\n  mastermind quit      reveal');

    // ======================== TWENTYFOUR (Game) ========================
    this.reg('twentyfour', args => {
      const nums = (s) => { this._gameState = { type:'24', nums:(s||Array.from({length:4},()=>Math.floor(Math.random()*9)+1)), solved:false }; };
      if (args.length === 0 || args[0] === 'start') {
        nums();
        this.line('  The 24 Game! Use +, -, *, / and () to make 24.', 'em');
        this.line('  Numbers: ' + this._gameState.nums.join(', '), '');
        this.line('  Use: twentyfour <expression>  |  twentyfour solve  |  twentyfour new', 'dim'); return;
      }
      if (!this._gameState || this._gameState.type !== '24') { nums(); this.line('  New game started.', 'dim'); }
      if (args[0] === 'new') { nums(); this.line('  Numbers: ' + this._gameState.nums.join(', '), ''); return; }
      if (args[0] === 'solve') {
        // Try all combinations
        const a = this._gameState.nums;
        const ops = ['+','-','*','/'];
        let found = false;
        for (let i = 0; i < 4 && !found; i++) for (let j = 0; j < 4 && !found; j++) if (j !== i) for (let k = 0; k < 4 && !found; k++) if (k !== i && k !== j) for (let l = 0; l < 4 && !found; l++) if (l !== i && l !== j && l !== k) {
          const vals = [a[i],a[j],a[k],a[l]];
          for (let o1 = 0; o1 < 4 && !found; o1++) for (let o2 = 0; o2 < 4 && !found; o2++) for (let o3 = 0; o3 < 4 && !found; o3++) {
            const expressions = [
              `(${vals[0]}${ops[o1]}${vals[1]})${ops[o2]}(${vals[2]}${ops[o3]}${vals[3]})`,
              `((${vals[0]}${ops[o1]}${vals[1]})${ops[o2]}${vals[2]})${ops[o3]}${vals[3]}`,
              `(${vals[0]}${ops[o1]}(${vals[1]}${ops[o2]}${vals[2]}))${ops[o3]}${vals[3]}`,
              `${vals[0]}${ops[o1]}(${vals[1]}${ops[o2]}(${vals[2]}${ops[o3]}${vals[3]}))`,
              `${vals[0]}${ops[o1]}((${vals[1]}${ops[o2]}${vals[2]})${ops[o3]}${vals[3]})`,
            ];
            for (const expr of expressions) {
              try { const r = new Function('return ' + expr)(); if (Math.abs(r - 24) < 0.0001) { this.line('  Solution: ' + expr + ' = 24', 'ok'); found = true; break; } } catch(e) {}
            }
          }
        }
        if (!found) this.line('  No solution found (this can happen!).', 'warn');
        this._gameState.solved = true; return;
      }
      const expr = args.join(' ').replace(/\^/g,'**').replace(/x/g,'*');
      const used = expr.match(/\d+/g)||[]; const numsCopy = [...this._gameState.nums];
      for (const n of used) { const idx = numsCopy.indexOf(parseInt(n)); if (idx >= 0) numsCopy.splice(idx, 1); else if (numsCopy.length > 0) { /* allow extra numbers */ } }
      try {
        const result = new Function('return ' + expr)();
        if (Math.abs(result - 24) < 0.0001) {
          this.line('  ' + expr + ' = ' + this.fmt(result), '');
          this.line('  Correct! You made 24!', 'ok');
          this._gameState.solved = true;
        } else {
          this.line('  ' + expr + ' = ' + this.fmt(result) + '  (not 24)', 'err');
        }
      } catch(e) { this.line('  Invalid expression.', 'err'); }
    }, 'twentyfour [expr]\n  Make 24 from 4 numbers using +,-,*,/.\n  twentyfour        start new game\n  twentyfour (1+2)*3+4   try expression\n  twentyfour solve  show solution\n  twentyfour new    new numbers');

    // ======================== MINES (Game) ========================
    this.reg('mines', args => {
      const createGrid = (rows, cols, mines) => {
        const grid = Array.from({length:rows}, () => Array(cols).fill(0));
        const revealed = Array.from({length:rows}, () => Array(cols).fill(false));
        const flagged = Array.from({length:rows}, () => Array(cols).fill(false));
        let placed = 0;
        while (placed < mines) { const r = Math.floor(Math.random()*rows), c = Math.floor(Math.random()*cols); if (grid[r][c] !== -1) { grid[r][c] = -1; placed++; } }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (grid[r][c] === -1) continue; let cnt = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const nr = r+dr, nc = c+dc; if (nr>=0&&nr<rows&&nc>=0&&nc<cols&&grid[nr][nc]===-1) cnt++; } grid[r][c] = cnt; }
        return { grid, revealed, flagged, rows, cols, mines, status:'playing' };
      };
      const reveal = (gs, r, c) => {
        if (r<0||r>=gs.rows||c<0||c>=gs.cols||gs.revealed[r][c]||gs.flagged[r][c]) return;
        gs.revealed[r][c] = true;
        if (gs.grid[r][c] === -1) { gs.status = 'lost'; return; }
        if (gs.grid[r][c] === 0) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr!==0||dc!==0) reveal(gs, r+dr, c+dc);
      };
      const showGrid = (gs) => {
        this.line('     ' + Array.from({length:gs.cols}, (_,i) => i.toString().padStart(2)).join(' '), 'dim');
        this.line('   ' + String.fromCharCode(0x2500).repeat(gs.cols*3+1), 'dim');
        for (let r = 0; r < gs.rows; r++) {
          let row = r.toString().padStart(2) + ' ' + String.fromCharCode(0x2502);
          for (let c = 0; c < gs.cols; c++) {
            if (gs.flagged[r][c]) row += ' F';
            else if (!gs.revealed[r][c]) row += ' ' + String.fromCharCode(0x25A0);
            else if (gs.grid[r][c] === -1) row += ' ' + String.fromCharCode(0x00D7);
            else row += ' ' + (gs.grid[r][c]||' ');
          }
          this.line(row, '');
        }
        this.line('   ' + String.fromCharCode(0x2500).repeat(gs.cols*3+1), 'dim');
        const flags = gs.flagged.flat().filter(Boolean).length;
        this.line('  Mines: ' + gs.mines + '  Flags: ' + flags, 'dim');
      };
      if (args.length === 0 || args[0] === 'start') {
        const R = 8, C = 8, M = 10;
        this._gameState = createGrid(R, C, M);
        this.line('  Minesweeper (' + R + 'x' + C + ', ' + M + ' mines)', 'em');
        this.line('  mines <r> <c>       reveal cell', 'dim');
        this.line('  mines flag <r> <c>  flag/unflag', 'dim');
        showGrid(this._gameState); return;
      }
      if (!this._gameState || this._gameState.type !== 'mines') { this.line('  No game. Type "mines" to start.', 'warn'); return; }
      if (args[0] === 'quit') { this._gameState = null; this.line('  Game ended.', 'dim'); return; }
      const gs = this._gameState;
      if (gs.status !== 'playing') { this.line('  Game over! Type "mines" for new game.', 'warn'); return; }
      if (args[0] === 'flag' && args.length >= 3) {
        const r = parseInt(args[1]), c = parseInt(args[2]);
        if (isNaN(r)||isNaN(c)||r<0||r>=gs.rows||c<0||c>=gs.cols) { this.line('  Invalid.', 'err'); return; }
        if (gs.revealed[r][c]) { this.line('  Already revealed.', 'warn'); return; }
        gs.flagged[r][c] = !gs.flagged[r][c];
        showGrid(gs); return;
      }
      const r = parseInt(args[0]), c = parseInt(args[1]);
      if (isNaN(r)||isNaN(c)||r<0||r>=gs.rows||c<0||c>=gs.cols) { this.line('  Invalid. Use: mines <r> <c>', 'err'); return; }
      if (gs.flagged[r][c]) { this.line('  Cell is flagged. Unflag first.', 'warn'); return; }
      reveal(gs, r, c);
      showGrid(gs);
      if (gs.status === 'lost') { this.line('  Boom! You hit a mine!', 'err'); this._gameState = null; return; }
      const totalCells = gs.rows * gs.cols;
      const revealed = gs.revealed.flat().filter(Boolean).length;
      if (totalCells - revealed === gs.mines) { this.line('  You cleared all mines!', 'ok'); this._gameState = null; }
    }, 'mines [r c]\n  Minesweeper game (8x8, 10 mines).\n  mines              start\n  mines 3 4          reveal cell at row 3, col 4\n  mines flag 3 4     flag cell\n  mines quit         end');

    // ======================== CONNECT4 (Game) ========================
    this.reg('connect4', args => {
      const R=6, C=7;
      const showBoard = (b) => {
        this.br();
        this.line('   1  2  3  4  5  6  7', 'dim');
        for (let r = 0; r < R; r++) {
          let row = '  ';
          for (let c = 0; c < C; c++) row += ' ' + (b[r][c]||'.') + ' ';
          this.line(row, '');
        }
        this.line('  ' + String.fromCharCode(0x2500).repeat(21), 'dim');
        this.br();
      };
      const checkWin = (b, piece) => {
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
          if (b[r][c] !== piece) continue;
          if (c+3<C && b[r][c+1]===piece && b[r][c+2]===piece && b[r][c+3]===piece) return true;
          if (r+3<R && b[r+1][c]===piece && b[r+2][c]===piece && b[r+3][c]===piece) return true;
          if (r+3<R && c+3<C && b[r+1][c+1]===piece && b[r+2][c+2]===piece && b[r+3][c+3]===piece) return true;
          if (r+3<R && c-3>=0 && b[r+1][c-1]===piece && b[r+2][c-2]===piece && b[r+3][c-3]===piece) return true;
        }
        return false;
      };
      const isValid = (b, col) => col >= 0 && col < C && b[0][col] === null;
      const dropPiece = (b, col, piece) => { for (let r = R-1; r >= 0; r--) { if (!b[r][col]) { b[r][col] = piece; return r; } } return -1; };
      if (args.length === 0 || args[0] === 'start') {
        this._gameState = { type:'connect4', board:Array.from({length:R},()=>Array(C).fill(null)), turn:'R' };
        this.line('  Connect Four! (you = R, AI = Y)', 'em');
        this.line('  connect4 <col>  (1-7)  |  connect4 quit', 'dim');
        showBoard(this._gameState.board); return;
      }
      if (!this._gameState || this._gameState.type !== 'connect4') { this.line('  No game. Type "connect4" to start.', 'warn'); return; }
      if (args[0] === 'quit') { this._gameState = null; this.line('  Game ended.', 'dim'); return; }
      const gs = this._gameState; const col = parseInt(args[0]) - 1;
      if (isNaN(col) || !isValid(gs.board, col)) { this.line('  Column 1-7 is full or invalid.', 'warn'); return; }
      dropPiece(gs.board, col, 'R');
      if (checkWin(gs.board, 'R')) { showBoard(gs.board); this.line('  You win!', 'ok'); this._gameState = null; return; }
      if (gs.board[0].every(c => c)) { showBoard(gs.board); this.line('  Tie!', 'hl'); this._gameState = null; return; }
      // AI move (simple: random valid)
      let aiCol; const validCols = []; for (let c = 0; c < C; c++) if (isValid(gs.board, c)) validCols.push(c);
      if (validCols.length > 0) {
        // Try to win
        let found = false;
        for (const ac of validCols) { const testBoard = gs.board.map(r => [...r]); dropPiece(testBoard, ac, 'Y'); if (checkWin(testBoard, 'Y')) { aiCol = ac; found = true; break; } }
        if (!found) { // Block player win
          for (const ac of validCols) { const testBoard = gs.board.map(r => [...r]); dropPiece(testBoard, ac, 'R'); if (checkWin(testBoard, 'R')) { aiCol = ac; found = true; break; } }
        }
        if (!found) aiCol = validCols[Math.floor(Math.random()*validCols.length)];
        dropPiece(gs.board, aiCol, 'Y');
      }
      showBoard(gs.board);
      if (checkWin(gs.board, 'Y')) { this.line('  AI wins!', 'err'); this._gameState = null; return; }
      if (gs.board[0].every(c => c)) { this.line('  Tie!', 'hl'); this._gameState = null; return; }
      this.line('  Your turn (R): connect4 <col 1-7>', 'dim');
    }, 'connect4 <col>\n  Connect Four vs AI.\n  connect4          start new game\n  connect4 3        drop in column 3\n  connect4 quit     end');

    // ======================== SUDOKU (Game) ========================
    this.reg('sudoku', args => {
      // Generate a simple sudoku puzzle using template
      const templates = [
        '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
        '020000000000600300074000800000020090080003017000950040300000520500007680000080003',
        '100007090030020008009600500005300900010080002600004000300000010040000007007000300',
      ];
      const templateStr = templates[Math.floor(Math.random()*templates.length)];
      const answer = '123456789'; // placeholder
      const parseBoard = (s) => { const b = []; for (let i = 0; i < 9; i++) b.push(s.slice(i*9,i*9+9).split('').map(c => parseInt(c)||0)); return b; };
      const printBoard = (b, sol) => {
        this.br();
        for (let r = 0; r < 9; r++) {
          let row = '  ';
          for (let c = 0; c < 9; c++) {
            const v = b[r][c];
            const isGiven = sol ? sol[r][c] !== 0 : v !== 0;
            row += (v||'.') + ' ';
            if (c === 2 || c === 5) row += '│ ';
          }
          this.line(row, '');
          if (r === 2 || r === 5) this.line('  ' + String.fromCharCode(0x2500).repeat(21), 'dim');
        }
        this.br();
      };
      const isValidPlace = (b, r, c, num) => {
        for (let i = 0; i < 9; i++) if (b[r][i] === num || b[i][c] === num) return false;
        const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
        for (let i = br; i < br+3; i++) for (let j = bc; j < bc+3; j++) if (b[i][j] === num) return false;
        return true;
      };
      const solveSudoku = (b) => {
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
          if (b[r][c] !== 0) continue;
          for (let num = 1; num <= 9; num++) { if (isValidPlace(b, r, c, num)) { b[r][c] = num; if (solveSudoku(b)) return true; b[r][c] = 0; } }
          return false;
        }
        return true;
      };
      if (args.length === 0 || args[0] === 'start') {
        const board = parseBoard(templateStr);
        const solution = parseBoard(templateStr);
        // Actually generate by using a known solved board; for simplicity just use the template
        const fixed = parseBoard(templateStr);
        this._gameState = { type:'sudoku', board: fixed.map(r=>[...r]), fixed: fixed.map(r=>[...r]) };
        this.line('  Sudoku! Fill the grid (1-9).', 'em');
        this.line('  sudoku <r> <c> <v>     set cell', 'dim');
        this.line('  sudoku hint            show hint', 'dim');
        this.line('  sudoku solve           show solution', 'dim');
        this.line('  sudoku check           check progress', 'dim');
        printBoard(this._gameState.board, this._gameState.fixed); return;
      }
      if (!this._gameState || this._gameState.type !== 'sudoku') { this.line('  No game. Type "sudoku" to start.', 'warn'); return; }
      if (args[0] === 'quit') { this._gameState = null; this.line('  Game ended.', 'dim'); return; }
      if (args[0] === 'solve') {
        const solBoard = this._gameState.board.map(r => [...r]);
        if (solveSudoku(solBoard)) {
          this.line('  Solution:', 'hl');
          printBoard(solBoard, this._gameState.fixed);
        } else { this.line('  No solution found.', 'err'); }
        return;
      }
      if (args[0] === 'check') {
        const b = this._gameState.board;
        let valid = true, filled = 0;
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { if (b[r][c] === 0) continue; filled++; if (!isValidPlace(b, r, c, b[r][c])) { valid = false; } }
        if (filled === 81 && valid) this.line('  Congratulations! Sudoku solved!', 'ok');
        else if (valid) this.line('  Valid so far (' + filled + '/81 filled). Keep going!', 'hl');
        else this.line('  Invalid placement found. Check your entries.', 'err');
        return;
      }
      if (args[0] === 'hint') {
        const hintBoard = this._gameState.board.map(r => [...r]);
        if (solveSudoku(hintBoard)) {
          for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
            if (this._gameState.board[r][c] === 0 && hintBoard[r][c] !== 0) {
              this._gameState.board[r][c] = hintBoard[r][c];
              this.line('  Hint: placed ' + hintBoard[r][c] + ' at (' + r + ',' + c + ')', 'hl');
              printBoard(this._gameState.board, this._gameState.fixed); return;
            }
          }
        }
        this.line('  No hint available.', 'warn'); return;
      }
      const r = parseInt(args[0]), c = parseInt(args[1]), v = parseInt(args[2]);
      if (isNaN(r)||isNaN(c)||isNaN(v)||r<0||r>8||c<0||c>8||v<1||v>9) { this.line('  Use: sudoku <row> <col> <val> (0-8, 0-8, 1-9)', 'warn'); return; }
      if (this._gameState.fixed[r][c] !== 0) { this.line('  That cell is fixed (given by puzzle).', 'warn'); return; }
      if (!isValidPlace(this._gameState.board, r, c, v)) { this.line('  Invalid move! ' + v + ' conflicts.', 'err'); return; }
      this._gameState.board[r][c] = v;
      printBoard(this._gameState.board, this._gameState.fixed);
      let filled = 0, valid = true;
      for (let rr = 0; rr < 9; rr++) for (let cc = 0; cc < 9; cc++) { if (this._gameState.board[rr][cc] === 0) continue; filled++; if (!isValidPlace(this._gameState.board, rr, cc, this._gameState.board[rr][cc])) valid = false; }
      if (filled === 81 && valid) { this.line('  Sudoku solved!', 'ok'); this._gameState = null; }
    }, 'sudoku [r c v]\n  Sudoku puzzle game.\n  sudoku start         new puzzle\n  sudoku 0 2 5         set row 0, col 2 to 5\n  sudoku hint          show a hint\n  sudoku solve         show solution\n  sudoku check         check progress');

    // ======================== MANDELBROT ========================
    this.reg('mandelbrot', args => {
      const xmin = parseFloat(args[0])||-2, xmax = parseFloat(args[1])||1, ymin = parseFloat(args[2])||-1.2, ymax = parseFloat(args[3])||1.2;
      const W = 70, H = 24, maxIter = 50;
      const chars = ' .:-=+*#%@';
      this.br(); this.line('  Mandelbrot Set', 'em');
      this.line('  [' + this.fmt(xmin) + ', ' + this.fmt(xmax) + '] × [' + this.fmt(ymin) + ', ' + this.fmt(ymax) + ']', 'dim');
      this.br();
      for (let row = 0; row < H; row++) {
        const cy = ymin + (ymax - ymin) * row / H;
        let line = '';
        for (let col = 0; col < W; col++) {
          const cx = xmin + (xmax - xmin) * col / W;
          let zx = 0, zy = 0, iter = 0;
          while (zx * zx + zy * zy < 4 && iter < maxIter) { const nx = zx * zx - zy * zy + cx; zy = 2 * zx * zy + cy; zx = nx; iter++; }
          line += chars[Math.min(chars.length - 1, Math.floor(iter * chars.length / maxIter))];
        }
        this.line('  ' + line, '');
      }
      this.br();
    }, 'mandelbrot [xmin] [xmax] [ymin] [ymax]\n  ASCII Mandelbrot set fractal.\n  Example:  mandelbrot');

    // ======================== JULIA ========================
    this.reg('julia', args => {
      const cx = parseFloat(args[0])||-0.7, cy = parseFloat(args[1])||0.27;
      const W = 70, H = 24, maxIter = 50;
      const chars = ' .:-=+*#%@';
      this.br(); this.line('  Julia Set (c = ' + this.fmt(cx) + ' + ' + this.fmt(cy) + 'i)', 'em');
      this.br();
      for (let row = 0; row < H; row++) {
        const zy = 1.5 - 3 * row / H;
        let line = '';
        for (let col = 0; col < W; col++) {
          let zx = -2 + 3 * col / W; let iter = 0;
          while (zx * zx + zy * zy < 4 && iter < maxIter) { const nx = zx * zx - zy * zy + cx; zy = 2 * zx * zy + cy; zx = nx; iter++; }
          line += chars[Math.min(chars.length - 1, Math.floor(iter * chars.length / maxIter))];
        }
        this.line('  ' + line, '');
      }
      this.br();
    }, 'julia [cx] [cy]\n  ASCII Julia set fractal.\n  Default: c = -0.7 + 0.27i\n  Example:  julia -0.4 0.6');

    // ======================== SIERPINSKI ========================
    this.reg('sierpinski', args => {
      const n = Math.min(8, Math.max(1, parseInt(args[0])||5));
      const size = Math.pow(2, n);
      const grid = Array.from({length:size}, () => Array(size*2).fill(' '));
      const draw = (x, y, w) => { if (w < 2) { grid[y][x] = '*'; return; } const hw = w/2; draw(x, y, hw); draw(x+hw, y, hw); draw(x+hw/2, y+hw, hw); };
      draw(0, 0, size);
      this.br(); this.line('  Sierpinski Triangle (n=' + n + ')', 'em');
      for (let r = 0; r < size; r++) {
        let line = '';
        for (let c = 0; c < size * 2; c++) line += grid[r][c]||' ';
        if (line.trim()) this.line('  ' + line.replace(/\s+$/, ''), '');
      }
      this.br();
    }, 'sierpinski [n]\n  ASCII Sierpinski triangle (1-8).\n  Example:  sierpinski 6');

    // ======================== LOGISTIC ========================
    this.reg('logistic', args => {
      const r = parseFloat(args[0])||3.5, x0 = parseFloat(args[1])||0.5, n = Math.min(100, Math.max(10, parseInt(args[2])||40));
      if (isNaN(r)||isNaN(x0)||isNaN(n)) { this.line('  Invalid.', 'err'); return; }
      let x = x0;
      this.br(); this.line('  Logistic Map: r=' + this.fmt(r) + ', x' + String.fromCharCode(0x2080) + '=' + this.fmt(x0), 'em');
      this.br();
      for (let i = 0; i < n; i++) {
        x = r * x * (1 - x);
        const barLen = Math.round(x * 50);
        this.line('  ' + (i+1).toString().padStart(3) + ': ' + String.fromCharCode(0x2588).repeat(barLen).padEnd(50) + ' ' + this.fmt(x), '');
      }
      this.br();
    }, 'logistic <r> <x0> <n>\n  Logistic map (chaos theory).\n  Example:  logistic 3.9 0.5 30');

    // ======================== LORENZ ========================
    this.reg('lorenz', args => {
      const n = Math.min(2000, Math.max(100, parseInt(args[0])||1000));
      const dt = 0.01; let x = 1, y = 1, z = 1;
      const sigma = 10, rho = 28, beta = 8/3;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      const pts = [];
      for (let i = 0; i < n; i++) {
        x += dt * sigma * (y - x); y += dt * (x * (rho - z) - y); z += dt * (x * y - beta * z);
        pts.push([x, z]); if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const W = 60, H = 18;
      this.br(); this.line('  Lorenz Attractor (n=' + n + ')', 'em');
      this.line('  σ=' + sigma + ' ρ=' + rho + ' β=' + beta.toFixed(3), 'dim');
      this.br();
      const xRange = maxX - minX || 1, zRange = maxZ - minZ || 1;
      const plot = Array.from({length:H}, () => Array(W).fill(' '));
      pts.forEach(([px, pz]) => {
        const col = Math.round((px - minX) / xRange * (W - 1));
        const row = Math.round((pz - minZ) / zRange * (H - 1));
        if (col >= 0 && col < W && row >= 0 && row < H) plot[row][col] = '·';
      });
      plot.forEach(r => this.line('  ' + r.join(''), ''));
      this.br();
    }, 'lorenz [n]\n  Lorenz attractor (chaos theory).\n  Example:  lorenz 1500');

    // ======================== HENON ========================
    this.reg('henon', args => {
      const n = Math.min(500, Math.max(10, parseInt(args[0])||200));
      let x = 0.1, y = 0; const a = 1.4, b = 0.3;
      const pts = []; let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < n + 100; i++) {
        const nx = 1 - a * x * x + y, ny = b * x;
        x = nx; y = ny; if (i >= 100) { pts.push([x, y]); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      const W = 60, H = 20;
      this.br(); this.line('  Henon Map (a=' + a + ', b=' + b + ')', 'em');
      const xR = maxX - minX || 1, yR = maxY - minY || 1;
      const plot = Array.from({length:H}, () => Array(W).fill(' '));
      pts.forEach(([px, py]) => {
        const col = Math.round((px - minX) / xR * (W - 1));
        const row = Math.round((py - minY) / yR * (H - 1));
        if (col >= 0 && col < W && row >= 0 && row < H) plot[row][col] = '·';
      });
      plot.forEach(r => this.line('  ' + r.join(''), ''));
      this.br();
    }, 'henon [n]\n  Henon map (2D chaotic map).\n  Example:  henon 300');

    // ======================== BIFURCATION ========================
    this.reg('bifurcation', args => {
      const rmin = parseFloat(args[0])||2.5, rmax = parseFloat(args[1])||4, n = Math.min(500, Math.max(50, parseInt(args[2])||200));
      const H = 22, W = 68;
      this.br(); this.line('  Bifurcation Diagram (logistic map)', 'em');
      this.line('  r' + String.fromCharCode(0x2208) + '[' + this.fmt(rmin) + ', ' + this.fmt(rmax) + ']', 'dim');
      this.br();
      const plot = Array.from({length:H}, () => Array(W).fill(' '));
      for (let i = 0; i <= W; i++) {
        const r = rmin + (rmax - rmin) * i / W;
        let x = 0.5;
        for (let j = 0; j < 500; j++) x = r * x * (1 - x);
        for (let j = 0; j < n; j++) {
          x = r * x * (1 - x);
          const row = Math.round((1 - x) * (H - 1));
          if (row >= 0 && row < H) plot[row][i] = '·';
        }
      }
      plot.forEach(r => this.line('  ' + r.join(''), ''));
      this.br();
    }, 'bifurcation [rmin] [rmax] [pts]\n  Bifurcation diagram of the logistic map.\n  Example:  bifurcation');

    // ======================== DFT ========================
    this.reg('dft', args => {
      if (args.length < 2) { this.line('  Usage: dft <values...>', 'warn'); return; }
      const signal = args.map(parseFloat).filter(v => isFinite(v));
      if (signal.length < 2) { this.line('  Need at least 2 values.', 'err'); return; }
      const N = signal.length;
      this.br(); this.line('  DFT (n=' + N + ')', 'em');
      this.line('  ' + '─'.repeat(50), 'dim');
      this.line('    k    Real        Imag        Mag         Phase(°)', '');
      this.line('  ' + '─'.repeat(50), 'dim');
      for (let k = 0; k < Math.min(N, 20); k++) {
        let re = 0, im = 0;
        for (let n = 0; n < N; n++) { const ang = -2 * Math.PI * k * n / N; re += signal[n] * Math.cos(ang); im += signal[n] * Math.sin(ang); }
        this.line('  ' + k.toString().padStart(3) + '  ' + this.fmt(re).padStart(10) + ' ' + this.fmt(im).padStart(10) + ' ' + this.fmt(Math.sqrt(re*re+im*im)).padStart(10) + ' ' + this.fmt(Math.atan2(im,re)*180/Math.PI).padStart(10), '');
      }
      this.line('  ' + '─'.repeat(50), 'dim');
      if (N > 20) this.line('  ... (' + (N - 20) + ' more bins)', 'dim');
      this.br();
    }, 'dft <values...>\n  Discrete Fourier Transform.\n  Example:  dft 1 0 -1 0');

    // ======================== FFT ========================
    this.reg('fft', args => {
      if (args.length < 2) { this.line('  Usage: fft <values...>', 'warn'); return; }
      let signal = args.map(parseFloat).filter(v => isFinite(v));
      if (signal.length < 2 || (signal.length & (signal.length - 1)) !== 0) { this.line('  Length must be a power of 2 and ≥ 2.', 'err'); return; }
      const N = signal.length;
      // Cooley-Tukey FFT (in-place, reorder first)
      const re = [...signal], im = Array(N).fill(0);
      for (let i = 0; i < N; i++) { const j = parseInt(i.toString(2).split('').reverse().join('').padEnd(Math.log2(N),'0'), 2); if (j > i) { [re[i], re[j]] = [re[j], re[i]]; } }
      for (let len = 2; len <= N; len *= 2) {
        const ang = -2 * Math.PI / len;
        const wRe = Math.cos(ang), wIm = Math.sin(ang);
        for (let i = 0; i < N; i += len) {
          let curRe = 1, curIm = 0;
          for (let j = 0; j < len / 2; j++) {
            const uRe = re[i + j], uIm = im[i + j];
            const vRe = re[i + j + len/2] * curRe - im[i + j + len/2] * curIm;
            const vIm = re[i + j + len/2] * curIm + im[i + j + len/2] * curRe;
            re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
            re[i + j + len/2] = uRe - vRe; im[i + j + len/2] = uIm - vIm;
            const nc = curRe * wRe - curIm * wIm; curIm = curRe * wIm + curIm * wRe; curRe = nc;
          }
        }
      }
      this.br(); this.line('  FFT (Cooley-Tukey, n=' + N + ')', 'em');
      this.line('  ' + '─'.repeat(50), 'dim');
      this.line('    k    Real        Imag        Mag', '');
      this.line('  ' + '─'.repeat(50), 'dim');
      for (let k = 0; k < Math.min(N, 16); k++) this.line('  ' + k.toString().padStart(3) + '  ' + this.fmt(re[k]).padStart(10) + ' ' + this.fmt(im[k]).padStart(10) + ' ' + this.fmt(Math.sqrt(re[k]*re[k]+im[k]*im[k])).padStart(10), '');
      this.line('  ' + '─'.repeat(50), 'dim');
      if (N > 16) this.line('  ... (' + (N - 16) + ' more bins)', 'dim');
      this.br();
    }, 'fft <values...>\n  Fast Fourier Transform (Cooley-Tukey).\n  Input length must be a power of 2.\n  Example:  fft 1 2 3 4');

    // ======================== LU ========================
    this.reg('lu', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: lu [[a,b],[c,d]]', 'warn'); return; }
      let A; try { A = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const n = A.length; if (n !== A[0].length) { this.line('  Square matrix only.', 'err'); return; }
      const L = Array.from({length:n}, (_,i) => Array(n).fill(0).map((_,j) => i===j?1:0));
      const U = Array.from({length:n}, () => Array(n).fill(0));
      const mat = A.map(r => [...r]);
      for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) { let sum = 0; for (let k = 0; k < i; k++) sum += L[i][k] * U[k][j]; U[i][j] = mat[i][j] - sum; }
        for (let j = i + 1; j < n; j++) { let sum = 0; for (let k = 0; k < i; k++) sum += L[j][k] * U[k][i]; L[j][i] = (mat[j][i] - sum) / (U[i][i] || 1); }
      }
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.br(); this.line('  LU Decomposition:', 'em');
      this.line('  L ='); this.line(fM(L), 'ok');
      this.line('  U ='); this.line(fM(U), 'ok');
      // Verify
      const prod = L.map((r,i) => U[0].map((_,j) => r.reduce((s,_,k) => s + L[i][k] * U[k][j], 0)));
      this.line('  L×U ='); this.line(fM(prod), 'dim');
      this.br();
    }, 'lu <matrix>\n  LU decomposition (Doolittle).\n  Example:  lu [[4,3],[6,3]]');

    // ======================== QR ========================
    this.reg('qr', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: qr [[a,b],[c,d]]', 'warn'); return; }
      let A; try { A = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const rows = A.length, cols = A[0].length;
      const Q = Array.from({length:rows}, () => Array(cols).fill(0));
      const R = Array.from({length:cols}, () => Array(cols).fill(0));
      const mat = A.map(r => [...r]);
      for (let k = 0; k < cols; k++) {
        let norm = 0; for (let i = 0; i < rows; i++) norm += mat[i][k] * mat[i][k];
        R[k][k] = Math.sqrt(norm); for (let i = 0; i < rows; i++) Q[i][k] = mat[i][k] / (R[k][k] || 1);
        for (let j = k + 1; j < cols; j++) { let sum = 0; for (let i = 0; i < rows; i++) sum += Q[i][k] * mat[i][j]; R[k][j] = sum; for (let i = 0; i < rows; i++) mat[i][j] -= Q[i][k] * R[k][j]; }
      }
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.br(); this.line('  QR Decomposition (Gram-Schmidt):', 'em');
      this.line('  Q ='); this.line(fM(Q), 'ok');
      this.line('  R ='); this.line(fM(R), 'ok');
      this.br();
    }, 'qr <matrix>\n  QR decomposition (Gram-Schmidt).\n  Example:  qr [[1,2],[3,4]]');

    // ======================== CHOLESKY ========================
    this.reg('cholesky', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: cholesky [[a,b],[c,d]]', 'warn'); return; }
      let A; try { A = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const n = A.length; if (n !== A[0].length) { this.line('  Square matrix only.', 'err'); return; }
      const L = Array.from({length:n}, () => Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          let sum = 0;
          for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
          L[i][j] = i === j ? Math.sqrt(A[i][i] - sum) : (A[i][j] - sum) / (L[j][j] || 1);
        }
      }
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.br(); this.line('  Cholesky Decomposition:', 'em');
      this.line('  L ='); this.line(fM(L), 'ok');
      this.line('  L' + String.fromCharCode(0x1D40) + ' ='); this.line(fM(L.map((r,i) => L.map((_,j) => L[j][i]))), 'ok');
      this.br();
    }, 'cholesky <matrix>\n  Cholesky decomposition (A must be SPD).\n  Example:  cholesky [[4,2],[2,3]]');

    // ======================== HESSIAN ========================
    this.reg('hessian', args => {
      if (args.length < 3) { this.line('  Usage: hessian <fn(x,y)> <x> <y>', 'warn'); return; }
      const fnStr = args.slice(0, -2).join(' '); const x = parseFloat(args[args.length-2]), y = parseFloat(args[args.length-1]);
      if (isNaN(x)||isNaN(y)) { this.line('  Invalid.', 'err'); return; }
      try {
        const f = new Function('x','y','return '+fnStr.replace(/\^/g,'**'));
        const h = 1e-6;
        const fxx = (f(x+h,y)-2*f(x,y)+f(x-h,y))/(h*h);
        const fyy = (f(x,y+h)-2*f(x,y)+f(x,y-h))/(h*h);
        const fxy = (f(x+h,y+h)-f(x+h,y-h)-f(x-h,y+h)+f(x-h,y-h))/(4*h*h);
        const det = fxx * fyy - fxy * fxy;
        this.br(); this.line('  Hessian of ' + fnStr + ' at (' + this.fmt(x) + ', ' + this.fmt(y) + '):', 'em');
        this.line('  H = | ' + this.fmt(fxx) + '  ' + this.fmt(fxy) + ' |', '');
        this.line('       | ' + this.fmt(fxy) + '  ' + this.fmt(fyy) + ' |', '');
        this.line('  det(H) = ' + this.fmt(det) + '  |  tr(H) = ' + this.fmt(fxx+fyy), 'dim');
        if (det > 0 && fxx > 0) this.line('  Local minimum', 'hl');
        else if (det > 0 && fxx < 0) this.line('  Local maximum', 'hl');
        else if (det < 0) this.line('  Saddle point', 'warn');
        else this.line('  Indeterminate', 'dim');
        this.br();
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'hessian <fn(x,y)> <x> <y>\n  Hessian matrix (2D second derivatives).\n  Example:  hessian x^2+y^2 1 1');

    // ======================== JACOBIAN ========================
    this.reg('jacobian', args => {
      if (args.length < 4) { this.line('  Usage: jacobian <f1(x,y)> <f2(x,y)> <x> <y>', 'warn'); return; }
      const f1Str = args[0], f2Str = args[1]; const x = parseFloat(args[2]), y = parseFloat(args[3]);
      if (isNaN(x)||isNaN(y)) { this.line('  Invalid.', 'err'); return; }
      try {
        const f1 = new Function('x','y','return '+f1Str.replace(/\^/g,'**'));
        const f2 = new Function('x','y','return '+f2Str.replace(/\^/g,'**'));
        const h = 1e-8;
        const df1dx = (f1(x+h,y)-f1(x-h,y))/(2*h), df1dy = (f1(x,y+h)-f1(x,y-h))/(2*h);
        const df2dx = (f2(x+h,y)-f2(x-h,y))/(2*h), df2dy = (f2(x,y+h)-f2(x,y-h))/(2*h);
        const det = df1dx * df2dy - df1dy * df2dx;
        this.br(); this.line('  Jacobian Matrix:', 'em');
        this.line('  J = | ' + this.fmt(df1dx) + '  ' + this.fmt(df1dy) + ' |', '');
        this.line('       | ' + this.fmt(df2dx) + '  ' + this.fmt(df2dy) + ' |', '');
        this.line('  det(J) = ' + this.fmt(det), 'dim');
        this.br();
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'jacobian <f1> <f2> <x> <y>\n  Jacobian matrix of two 2D functions.\n  Example:  jacobian x^2 y^2 1 1');

    // ======================== PSEUDOINV ========================
    this.reg('pseudoinv', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: pseudoinv [[a,b],[c,d],[e,f]]', 'warn'); return; }
      let A; try { A = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const rows = A.length, cols = A[0].length;
      // A+ = (A^T A)^-1 A^T for full column rank
      const AT = A[0].map((_,i) => A.map(r => r[i]));
      const ATA = AT.map(r => A[0].map((_,j) => r.reduce((s,_,k) => s + A[k][j] * r[k], 0)));
      const n = ATA.length;
      // Invert ATA via Gaussian elimination
      const inv = Array.from({length:n}, (_,i) => Array(n).fill(0).map((_,j) => i===j?1:0));
      const mat = ATA.map(r => [...r]);
      for (let col = 0; col < n; col++) {
        let maxRow = col; for (let r = col+1; r < n; r++) if (Math.abs(mat[r][col]) > Math.abs(mat[maxRow][col])) maxRow = r;
        [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]]; [inv[col], inv[maxRow]] = [inv[maxRow], inv[col]];
        const pv = mat[col][col]; if (Math.abs(pv) < 1e-12) continue;
        for (let j = 0; j < n; j++) { mat[col][j] /= pv; inv[col][j] /= pv; }
        for (let r = 0; r < n; r++) if (r !== col) { const f = mat[r][col]; for (let j = 0; j < n; j++) { mat[r][j] -= f * mat[col][j]; inv[r][j] -= f * inv[col][j]; } }
      }
      // A+ = inv(ATA) × AT
      const result = inv.map(r => AT[0].map((_,j) => r.reduce((s,_,k) => s + r[k] * AT[k][j], 0)));
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.br(); this.line('  Moore-Penrose Pseudoinverse (' + rows + '×' + cols + '):', 'em');
      this.line(fM(result), 'ok');
      this.br();
    }, 'pseudoinv <matrix>\n  Moore-Penrose pseudoinverse.\n  Example:  pseudoinv [[1,2],[3,4],[5,6]]');

    // ======================== DIJKSTRA ========================
    this.reg('dijkstra', args => {
      if (args.length < 4) { this.line('  Usage: dijkstra <adjacency> <start> <end>', 'warn'); this.line('  Adjacency: [[0,1,2],[1,0,3],[2,3,0]]', 'dim'); return; }
      const last = args.length - 1;
      const start = parseInt(args[last-1]), end = parseInt(args[last]);
      const str = args.slice(0, last-1).join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Invalid.', 'err'); return; }
      let graph; try { graph = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const n = graph.length; const dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), visited = Array(n).fill(false);
      dist[start] = 0;
      for (let i = 0; i < n; i++) {
        let u = -1, minDist = Infinity;
        for (let v = 0; v < n; v++) if (!visited[v] && dist[v] < minDist) { minDist = dist[v]; u = v; }
        if (u === -1) break; visited[u] = true;
        for (let v = 0; v < n; v++) { if (!visited[v] && graph[u][v] > 0 && dist[u] + graph[u][v] < dist[v]) { dist[v] = dist[u] + graph[u][v]; prev[v] = u; } }
      }
      this.br(); this.line('  Dijkstra (node ' + start + ' → ' + end + '):', 'em');
      if (!isFinite(dist[end])) { this.line('  No path found.', 'err'); return; }
      this.line('  Distance: ' + this.fmt(dist[end]), 'ok');
      const path = []; for (let v = end; v !== -1; v = prev[v]) path.push(v); path.reverse();
      this.line('  Path: ' + path.join(' → '), 'dim');
      this.line('  All distances:', '');
      for (let i = 0; i < n; i++) this.line('    ' + start + ' → ' + i + ': ' + (isFinite(dist[i]) ? this.fmt(dist[i]) : '∞'), '');
      this.br();
    }, 'dijkstra <adjacency> <start> <end>\n  Dijkstras shortest path.\n  Example:  dijkstra [[0,2,4],[2,0,1],[4,1,0]] 0 2');

    // ======================== FLOYD ========================
    this.reg('floyd', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: floyd [[...]]', 'warn'); return; }
      let mat; try { mat = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const n = mat.length; const dist = mat.map(r => r.map(v => v === 0 && r !== mat.map(x => x)[0] ? Infinity : v));
      for (let i = 0; i < n; i++) dist[i][i] = 0;
      for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (dist[i][k] + dist[k][j] < dist[i][j]) dist[i][j] = dist[i][k] + dist[k][j];
      this.br(); this.line('  Floyd-Warshall All-Pairs Shortest Paths:', 'em');
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => isFinite(v) ? this.fmt(v).padStart(6) : '    ' + String.fromCharCode(0x221E)).join('  ') + ' |').join('\n');
      this.line(fM(dist), 'ok');
      // Detect negative cycles
      for (let i = 0; i < n; i++) if (dist[i][i] < 0) { this.line('  (Negative cycle detected)', 'warn'); break; }
      this.br();
    }, 'floyd <matrix>\n  Floyd-Warshall all-pairs shortest paths.\n  Example:  floyd [[0,3,0],[3,0,1],[0,1,0]]');

    // ======================== KRUSKAL ========================
    this.reg('kruskal', args => {
      if (args.length < 3) { this.line('  Usage: kruskal <u,v,w> <u,v,w> ...', 'warn'); this.line('  Edges as: 0,1,2  (node0--node1 weight 2)', 'dim'); return; }
      const edges = []; args.forEach(a => { const p = a.split(',').map(parseFloat); if (p.length >= 3 && !isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2])) edges.push({u:p[0],v:p[1],w:p[2]}); });
      if (edges.length < 2) { this.line('  Need at least 2 edges.', 'err'); return; }
      edges.sort((a,b) => a.w - b.w);
      const nodes = new Set(); edges.forEach(e => { nodes.add(e.u); nodes.add(e.v); });
      const parent = {}; nodes.forEach(n => parent[n] = n);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const union = (x, y) => { const rx = find(x), ry = find(y); if (rx !== ry) parent[ry] = rx; return rx !== ry; };
      const mst = []; let totalW = 0;
      for (const e of edges) { if (union(e.u, e.v)) { mst.push(e); totalW += e.w; } }
      this.br(); this.line('  Kruskal MST (' + mst.length + ' edges, ' + nodes.size + ' nodes):', 'em');
      this.line('  Total weight: ' + this.fmt(totalW), 'ok');
      mst.forEach(e => this.line('    ' + e.u + ' ── ' + e.v + '  (' + this.fmt(e.w) + ')', ''));
      this.br();
    }, 'kruskal <edges...>\n  Kruskals Minimum Spanning Tree.\n  Format each edge as: u,v,weight\n  Example:  kruskal 0,1,4 0,2,3 1,2,1');

    // ======================== BLACKSCHOLES ========================
    this.reg('blackscholes', args => {
      if (args.length < 5) { this.line('  Usage: blackscholes <S> <K> <T> <r> <sigma>', 'warn'); return; }
      const [S, K, T, r, sigma] = args.map(parseFloat);
      if ([S,K,T,r,sigma].some(v => isNaN(v) || v <= 0)) { this.line('  All values must be positive.', 'err'); return; }
      const d1 = (Math.log(S/K) + (r + sigma*sigma/2)*T) / (sigma*Math.sqrt(T));
      const d2 = d1 - sigma*Math.sqrt(T);
      const N = (x) => 0.5 * (1 + this._erf(x / Math.sqrt(2)));
      const call = S * N(d1) - K * Math.exp(-r * T) * N(d2);
      const put = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
      this.br(); this.line('  Black-Scholes Option Pricing:', 'em');
      this.line('  S=' + this.fmt(S) + '  K=' + this.fmt(K) + '  T=' + this.fmt(T) + '  r=' + this.fmt(r*100) + '%  σ=' + this.fmt(sigma*100) + '%', '');
      this.line('  ' + String.fromCharCode(0x2500).repeat(40), 'dim');
      this.line('  Call: ' + this.fmt(call), 'ok');
      this.line('  Put:  ' + this.fmt(put), 'ok');
      this.line('  d1 = ' + this.fmt(d1) + '  |  d2 = ' + this.fmt(d2), 'dim');
      // Greeks
      const phi = (x) => Math.exp(-x*x/2) / Math.sqrt(2*Math.PI);
      const deltaCall = N(d1), deltaPut = N(d1) - 1;
      const gamma = phi(d1) / (S * sigma * Math.sqrt(T));
      const vega = S * phi(d1) * Math.sqrt(T);
      const thetaCall = -(S * sigma * phi(d1)) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2);
      this.line('  ' + String.fromCharCode(0x2500).repeat(40), 'dim');
      this.line('  Greeks:', '');
      this.line('  Δ(Call)=' + this.fmt(deltaCall) + '  Δ(Put)=' + this.fmt(deltaPut), 'dim');
      this.line('  Γ=' + this.fmt(gamma) + '  |  ν=' + this.fmt(vega) + '  |  Θ(Call)=' + this.fmt(thetaCall), 'dim');
      this.br();
    }, 'blackscholes <S> <K> <T> <r> <sigma>\n  Black-Scholes option pricing with Greeks.\n  Example:  blackscholes 100 100 1 0.05 0.2');

    // ======================== SHARPE ========================
    this.reg('sharpe', args => {
      if (args.length < 2) { this.line('  Usage: sharpe <returns...> <rf>', 'warn'); return; }
      const rf = parseFloat(args[args.length-1]); const returns = args.slice(0,-1).map(parseFloat).filter(v => isFinite(v));
      if (returns.length < 2) { this.line('  Need at least 2 returns.', 'err'); return; }
      const mean = returns.reduce((s,v) => s+v, 0) / returns.length;
      const variance = returns.reduce((s,v) => s + (v-mean)**2, 0) / (returns.length-1);
      const std = Math.sqrt(variance);
      const sharpe = (mean - rf/100) / std * Math.sqrt(252);
      this.br(); this.line('  Sharpe Ratio:', 'em');
      this.line('    Mean return: ' + this.fmt(mean*100) + '%', '');
      this.line('    Risk-free: ' + this.fmt(rf) + '%', '');
      this.line('    Std dev: ' + this.fmt(std*100) + '%', 'dim');
      this.line('    Sharpe (annualized): ' + this.fmt(sharpe), 'ok');
      if (sharpe > 2) this.line('    Excellent!', 'em');
      else if (sharpe > 1) this.line('    Good.', 'hl');
      else if (sharpe > 0) this.line('    Acceptable.', 'dim');
      else this.line('    Negative return vs risk-free.', 'err');
      this.br();
    }, 'sharpe <returns...> <rf%>\n  Sharpe ratio (annualized, 252 days).\n  Example:  sharpe 0.01 0.02 -0.01 0.03 0.02 0.005');

    // ======================== BOND ========================
    this.reg('bond', args => {
      if (args.length < 4) { this.line('  Usage: bond <face> <coupon%> <years> <rate%>', 'warn'); return; }
      const [face, couponRate, years, mktRate] = args.map(parseFloat);
      if ([face,couponRate,years,mktRate].some(v => isNaN(v) || v < 0)) { this.line('  Invalid.', 'err'); return; }
      const coupon = face * couponRate / 100;
      const r = mktRate / 100;
      let pv = 0;
      for (let t = 1; t <= years; t++) pv += coupon / Math.pow(1 + r, t);
      pv += face / Math.pow(1 + r, years);
      const currentYield = coupon / pv * 100;
      const duration = (1/pv) * (Array.from({length:years}, (_,t) => (t+1)*coupon/Math.pow(1+r,t+1)).reduce((s,v) => s+v, 0) + years*face/Math.pow(1+r,years));
      this.br(); this.line('  Bond Pricing:', 'em');
      this.line('    Face: ' + this.fmt(face) + '  Coupon: ' + this.fmt(couponRate) + '%  Maturity: ' + years + 'y  Rate: ' + this.fmt(mktRate) + '%', '');
      this.line('    Price: ' + this.fmt(pv), 'ok');
      this.line('    Current Yield: ' + this.fmt(currentYield) + '%', 'dim');
      this.line('    Macaulay Duration: ' + this.fmt(duration) + ' years', 'dim');
      this.line('    Modified Duration: ' + this.fmt(duration / (1 + r)) + ' years', 'dim');
      if (pv > face) this.line('    Trading at premium', 'hl');
      else if (pv < face) this.line('    Trading at discount', 'warn');
      else this.line('    Trading at par', 'dim');
      this.br();
    }, 'bond <face> <coupon%> <years> <rate%>\n  Bond pricing with duration.\n  Example:  bond 1000 5 10 4');

    // ======================== VAR ========================
    this.reg('var', args => {
      if (args.length < 3) { this.line('  Usage: var <values...> <confidence%>', 'warn'); return; }
      const conf = parseFloat(args[args.length-1])/100; const vals = args.slice(0,-1).map(parseFloat).filter(v => isFinite(v));
      if (vals.length < 5) { this.line('  Need at least 5 values.', 'err'); return; }
      vals.sort((a,b) => a-b);
      const idx = Math.floor(vals.length * (1 - conf));
      const var95 = vals[idx];
      const mean = vals.reduce((s,v) => s+v, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s,v) => s + (v-mean)**2, 0) / (vals.length-1));
      this.br(); this.line('  Value at Risk (VaR):', 'em');
      this.line('    Confidence: ' + this.fmt(conf*100) + '%', '');
      this.line('    Historical VaR: ' + this.fmt(var95), 'ok');
      this.line('    Parametric VaR (95%): ' + this.fmt(mean - 1.645 * std), 'dim');
      this.line('    Mean: ' + this.fmt(mean*100) + '%  Std: ' + this.fmt(std*100) + '%', 'dim');
      this.line('    Conditional VaR (CVaR): ' + this.fmt(vals.slice(0, idx+1).reduce((s,v) => s+v, 0)/(idx+1)), 'dim');
      this.br();
    }, 'var <values...> <confidence%>\n  Value at Risk (historical & parametric).\n  Example:  var -0.02 -0.01 0 0.01 0.02 0.03 95');

    // ======================== SETOP ========================
    this.reg('setop', args => {
      if (args.length < 3) { this.line('  Usage: setop <op> <set1> <set2>', 'warn'); this.line('  Ops: union, intersect, diff, symdiff, cartesian', 'dim'); return; }
      const op = args[0].toLowerCase();
      const parseSet = (s) => { const m = s.match(/[\[{]?([\d.,\s]+)[\]}]?/); return m ? m[1].split(',').map(v => parseFloat(v.trim())).filter(v => isFinite(v)) : []; };
      const set1 = parseSet(args.slice(1).join(' '));
      const set2 = args.length > 2 ? parseSet(args[args.length-1]) : [];
      if (!set1.length && !set2.length) { this.line('  Need at least one set.', 'err'); return; }
      const s1 = [...new Set(set1)], s2 = [...new Set(set2)];
      const fmtSet = (s) => '{' + s.map(v => this.fmt(v)).join(', ') + '}';
      if (op === 'union') {
        const result = [...new Set([...s1, ...s2])];
        this.line('  ' + fmtSet(s1) + ' ' + String.fromCharCode(0x222A) + ' ' + fmtSet(s2) + ' = ' + fmtSet(result), 'ok');
        this.line('  Size: ' + result.length, 'dim');
      } else if (op === 'intersect' || op === 'inter') {
        const result = s1.filter(v => s2.includes(v));
        this.line('  ' + fmtSet(s1) + ' ' + String.fromCharCode(0x2229) + ' ' + fmtSet(s2) + ' = ' + fmtSet(result), 'ok');
        this.line('  Size: ' + result.length, 'dim');
      } else if (op === 'diff' || op === 'difference') {
        const result = s1.filter(v => !s2.includes(v));
        this.line('  ' + fmtSet(s1) + ' \\ ' + fmtSet(s2) + ' = ' + fmtSet(result), 'ok');
        this.line('  Size: ' + result.length, 'dim');
      } else if (op === 'symdiff' || op === 'symmetric') {
        const result = [...s1.filter(v => !s2.includes(v)), ...s2.filter(v => !s1.includes(v))];
        this.line('  ' + fmtSet(s1) + ' ' + String.fromCharCode(0x2206) + ' ' + fmtSet(s2) + ' = ' + fmtSet(result), 'ok');
        this.line('  Size: ' + result.length, 'dim');
      } else if (op === 'cartesian' || op === 'product') {
        const result = []; s1.forEach(a => s2.forEach(b => result.push('(' + this.fmt(a) + ',' + this.fmt(b) + ')')));
        this.line('  ' + fmtSet(s1) + ' × ' + fmtSet(s2) + ' has ' + result.length + ' pairs:', '');
        const chunks = []; for (let i = 0; i < result.length; i += 10) chunks.push(result.slice(i, i+10).join(' '));
        chunks.forEach(c => this.line('    ' + c, ''));
      } else if (op === 'power') {
        const s = s1; const result = [];
        for (let i = 0; i < Math.pow(2, s.length); i++) { const subset = []; for (let j = 0; j < s.length; j++) if (i & (1 << j)) subset.push(s[j]); result.push('{' + subset.map(v => this.fmt(v)).join(',') + '}'); }
        this.line('  ' + String.fromCharCode(0x2118) + '(' + fmtSet(s) + ') has ' + result.length + ' subsets:', '');
        const chunks = []; for (let i = 0; i < result.length; i += 8) chunks.push(result.slice(i, i+8).join(' '));
        chunks.forEach(c => this.line('    ' + c, ''));
      } else {
        this.line('  Ops: union, intersect, diff, symdiff, cartesian, power', 'warn');
      }
    }, 'setop <op> <set1> [set2]\n  Set operations.\n  Ops: union, intersect, diff, symdiff, cartesian, power\n  Example:  setop union 1,2,3 3,4,5');

    // ======================== MATRIX_POW ========================
    this.reg('matrix_pow', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: matrix_pow [[a,b],[c,d]] <n>', 'warn'); return; }
      let A; try { A = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const n = parseInt(args[args.length-1]);
      if (isNaN(n) || n < 0) { this.line('  Power must be non-negative integer.', 'err'); return; }
      if (A.length !== A[0].length) { this.line('  Square matrix only.', 'err'); return; }
      const dim = A.length;
      // Binary exponentiation
      let result = Array.from({length:dim}, (_,i) => Array(dim).fill(0).map((_,j) => i===j?1:0));
      let base = A.map(r => [...r]); let exp = n;
      const matMul = (X, Y) => X.map((r,i) => Y[0].map((_,j) => r.reduce((s,_,k) => s + X[i][k]*Y[k][j], 0)));
      while (exp > 0) { if (exp & 1) result = matMul(result, base); base = matMul(base, base); exp >>= 1; }
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.line('  A^' + n + ' ='); this.line(fM(result), 'ok');
    }, 'matrix_pow <matrix> <n>\n  Matrix power (binary exponentiation).\n  Example:  matrix_pow [[1,2],[3,4]] 3');

    // ======================== MATRIX_EXP ========================
    this.reg('matrix_exp', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: matrix_exp [[a,b],[c,d]] [terms]', 'warn'); return; }
      let A; try { A = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      const terms = Math.min(20, Math.max(5, parseInt(args[args.length-1]) || 10));
      if (A.length !== A[0].length) { this.line('  Square matrix only.', 'err'); return; }
      const dim = A.length;
      const matMul = (X, Y) => X.map((r,i) => Y[0].map((_,j) => r.reduce((s,_,k) => s + X[i][k]*Y[k][j], 0)));
      const matAdd = (X, Y) => X.map((r,i) => r.map((v,j) => v + Y[i][j]));
      const matScale = (X, s) => X.map(r => r.map(v => v * s));
      let exp = Array.from({length:dim}, (_,i) => Array(dim).fill(0).map((_,j) => i===j?1:0));
      let term = Array.from({length:dim}, (_,i) => Array(dim).fill(0).map((_,j) => i===j?1:0));
      let fact = 1;
      for (let k = 1; k <= terms; k++) { fact *= k; term = matMul(term, A); exp = matAdd(exp, matScale(term, 1/fact)); }
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.line('  exp(A) ' + String.fromCharCode(0x2248) + ' (Taylor, ' + terms + ' terms):'); this.line(fM(exp), 'ok');
    }, 'matrix_exp <matrix> [terms]\n  Matrix exponential via Taylor series.\n  Example:  matrix_exp [[0,1],[0,0]] 10');

    // ======================== SVD2 ========================
    this.reg('svd2', args => {
      const str = args.join(' '); const m = str.match(/\[\[.*?\]\]/g);
      if (!m) { this.line('  Usage: svd2 [[a,b],[c,d]]', 'warn'); return; }
      let A; try { A = JSON.parse(m[0].replace(/;/g, '],[')); } catch(e) { this.line('  Invalid.', 'err'); return; }
      if (A.length !== 2 || A[0].length !== 2) { this.line('  2×2 matrix only.', 'err'); return; }
      const [[a,b],[c,d]] = A;
      // Compute eigenvalues of A^T A
      const aTa = [[a*a+c*c, a*b+c*d], [a*b+c*d, b*b+d*d]];
      const tr = aTa[0][0] + aTa[1][1], det = aTa[0][0]*aTa[1][1] - aTa[0][1]*aTa[1][0];
      const disc = tr*tr - 4*det;
      if (disc < 0) { this.line('  Complex singular values (unusual).', 'err'); return; }
      const s1 = Math.sqrt((tr + Math.sqrt(disc))/2), s2 = Math.sqrt((tr - Math.sqrt(disc))/2);
      const fM = (mm) => mm.map(r => '  | ' + r.map(v => this.fmt(v)).join('  ') + ' |').join('\n');
      this.br(); this.line('  SVD (2×2):', 'em');
      this.line('  Singular values: σ' + String.fromCharCode(0x2081) + '=' + this.fmt(s1) + '  σ' + String.fromCharCode(0x2082) + '=' + this.fmt(s2), 'ok');
      this.line('  Condition number: ' + this.fmt(s1/(s2||1e-15)), 'dim');
      this.line('  Rank: ' + (s2 > 1e-12 ? 2 : 1), 'dim');
      this.br();
    }, 'svd2 <matrix>\n  SVD of a 2×2 matrix.\n  Example:  svd2 [[1,2],[3,4]]');

    // ======================== PCA ========================
    this.reg('pca', args => {
      if (args.length < 6) { this.line('  Usage: pca <x1,y1> <x2,y2> ...', 'warn'); return; }
      const pts = []; args.forEach(a => { const m = a.match(/([\d.-]+)\s*,?\s*([\d.-]+)/); if (m) pts.push([parseFloat(m[1]), parseFloat(m[2])]); });
      if (pts.length < 3) { this.line('  Need at least 3 points.', 'err'); return; }
      const n = pts.length;
      const mx = pts.reduce((s,p) => s+p[0],0)/n, my = pts.reduce((s,p) => s+p[1],0)/n;
      const cov = [[0,0],[0,0]];
      pts.forEach(([x,y]) => { cov[0][0] += (x-mx)*(x-mx); cov[1][1] += (y-my)*(y-my); cov[0][1] += (x-mx)*(y-my); });
      cov[0][0] /= n-1; cov[1][1] /= n-1; cov[0][1] /= n-1; cov[1][0] = cov[0][1];
      // 2x2 eigenvalues
      const tr = cov[0][0]+cov[1][1], det = cov[0][0]*cov[1][1]-cov[0][1]*cov[1][0], disc = tr*tr-4*det;
      const l1 = (tr+Math.sqrt(Math.max(0,disc)))/2, l2 = (tr-Math.sqrt(Math.max(0,disc)))/2;
      const v1x = Math.abs(cov[0][1]) > 1e-12 ? [l1-cov[1][1], cov[0][1]] : [1,0];
      const norm = Math.sqrt(v1x[0]*v1x[0]+v1x[1]*v1x[1]);
      v1x[0] /= norm; v1x[1] /= norm;
      this.br(); this.line('  PCA (' + n + ' points):', 'em');
      this.line('  Centroid: (' + this.fmt(mx) + ', ' + this.fmt(my) + ')', '');
      this.line('  Covariance matrix:', '');
      this.line('    | ' + this.fmt(cov[0][0]) + '  ' + this.fmt(cov[0][1]) + ' |', '');
      this.line('    | ' + this.fmt(cov[1][0]) + '  ' + this.fmt(cov[1][1]) + ' |', '');
      this.line('  PC1 (λ' + String.fromCharCode(0x2081) + '=' + this.fmt(l1) + '): direction=(' + this.fmt(v1x[0]) + ', ' + this.fmt(v1x[1]) + '), variance=' + this.fmt(l1/(l1+l2)*100) + '%', 'ok');
      this.line('  PC2 (λ' + String.fromCharCode(0x2082) + '=' + this.fmt(l2) + '): variance=' + this.fmt(l2/(l1+l2)*100) + '%', 'dim');
      this.br();
    }, 'pca <points...>\n  Principal Component Analysis (2D).\n  Example:  pca 1,1 2,2 3,3 4,4 5,5');

    // ======================== SIMPLEX ========================
    this.reg('simplex', args => {
      if (args.length < 3) { this.line('  Usage: simplex <fn> <a> <b> [n]', 'warn'); return; }
      const fnStr = args.slice(0,-2).join(' '); const a = parseFloat(args[args.length-2]), b = parseFloat(args[args.length-1]);
      if (isNaN(a)||isNaN(b)||a>=b) { this.line('  Invalid interval.', 'err'); return; }
      const n = parseInt(args[2])||1;
      try {
        const f = new Function('x','return '+fnStr.replace(/\^/g,'**'));
        const phi = (1+Math.sqrt(5))/2, invphi = 1/phi;
        let lo = a, hi = b; const tol = 1e-10; const maxIter = Math.min(200, Math.max(10, n));
        for (let i = 0; i < maxIter; i++) {
          const c = hi - (hi-lo)*invphi, d = lo + (hi-lo)*invphi;
          if (Math.abs(c-d) < tol) break;
          if (f(c) < f(d)) hi = d; else lo = c;
        }
        const xMin = (lo+hi)/2; const fMin = f(xMin);
        this.br(); this.line('  Golden Section Search on [' + this.fmt(a) + ', ' + this.fmt(b) + ']:', 'em');
        this.line('  Local minimum at x ' + String.fromCharCode(0x2248) + ' ' + this.fmt(xMin), 'ok');
        this.line('  f(x) ' + String.fromCharCode(0x2248) + ' ' + this.fmt(fMin), 'ok');
        this.line('  Interval: [' + this.fmt(lo) + ', ' + this.fmt(hi) + ']  |  ' + maxIter + ' iterations', 'dim');
        this.br();
      } catch(e) { this.line('  Error: ' + e.message, 'err'); }
    }, 'simplex <fn> <a> <b>\n  Golden-section search for local minimum.\n  Example:  simplex x^2-2 0 5');

    // ======================== FIB_HEAP ========================
    this.reg('fibheap', args => {
      const n = Math.min(90, Math.max(1, parseInt(args[0])||20));
      const fib = [0,1]; for (let i = 2; i <= n; i++) fib.push(fib[i-1]+fib[i-2]);
      this.line('  Fibonacci Heap Reference (F' + String.fromCharCode(0x2080) + ' to F' + String.fromCharCode(0x2099) + '):', '');
      const chunks = []; for (let i = 0; i <= n; i += 5) chunks.push(fib.slice(i, i+5).map((v,j) => 'F_'+(i+j)+'='+v.toLocaleString()).join('  '));
      chunks.forEach(c => this.line('    ' + c, ''));
    }, 'fibheap <n>\n  Fibonacci numbers reference table.\n  Example:  fibheap 30');
  },
  detMatrix(m) {
    const n = m.length;
    if (n === 1) return m[0][0];
    if (n === 2) return m[0][0]*m[1][1] - m[0][1]*m[1][0];
    let det = 0;
    for (let j = 0; j < n; j++) {
      const sub = m.slice(1).map(row => row.filter((_,k) => k !== j));
      det += (j % 2 === 0 ? 1 : -1) * m[0][j] * this.detMatrix(sub);
    }
    return det;
  },

  invMatrix(m) {
    const n = m.length;
    const det = this.detMatrix(m);
    if (det === 0) throw new Error('Matrix is singular.');
    if (n === 2) return [[m[1][1]/det, -m[0][1]/det], [-m[1][0]/det, m[0][0]/det]];
    const adj = Array.from({length:n}, () => Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const sub = m.filter((_,r) => r !== i).map(row => row.filter((_,c) => c !== j));
        adj[j][i] = ((i+j) % 2 === 0 ? 1 : -1) * this.detMatrix(sub);
      }
    return adj.map(row => row.map(v => v / det));
  },

  // ======================== GCD ========================
  gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while(b) { [a, b] = [b, a % b]; } return a; },

  // ======================== HELPERS ========================
  _factorial(n) { if (n < 2) return 1; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  _comb(n, k) { if (k < 0 || k > n) return 0; if (k === 0 || k === n) return 1; k = Math.min(k, n - k); let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; },

  _logGamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - this._logGamma(1 - x);
    x -= 1; const g = 7;
    const c = [0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.98436957801957e-6, 1.5056327351493116e-7];
    let s = c[0]; for (let i = 1; i < g + 2; i++) s += c[i] / (x + i);
    const t = x + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
  },

  _gamma(x) {
    if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * this._gamma(1 - x));
    return Math.exp(this._logGamma(x));
  },

  _erf(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + p * x);
    return sign * (1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  },

  _betaCF(x, a, b) {
    const fpmin = 1e-30; const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < fpmin) d = fpmin;
    d = 1 / d; let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
      c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
      c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-14) break;
    }
    return h;
  },

  _incBeta(x, a, b) {
    if (x < 0 || x > 1) return 0;
    if (x === 0 || x === 1) return x;
    const bt = Math.exp(this._logGamma(a + b) - this._logGamma(a) - this._logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * this._betaCF(x, a, b) / a;
    return 1 - bt * this._betaCF(1 - x, b, a) / b;
  },

  _regGamma(a, x) {
    if (x < 0 || a <= 0) return 0;
    let sum = 1 / a, term = 1 / a;
    for (let n = 1; n < 200; n++) { term *= x / (a + n); sum += term; if (Math.abs(term) < 1e-14 * Math.abs(sum)) break; }
    return sum * Math.exp(-x + a * Math.log(x) - this._logGamma(a));
  },

  // ======================== TOKENIZER ========================
  tokenize(input) {
    const tokens = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === '"') { inQuote = !inQuote; continue; }
      if (c === ' ' && !inQuote) { if (current) { tokens.push(current); current = ''; } }
      else { current += c; }
    }
    if (current) tokens.push(current);
    return tokens;
  },

  // ======================== FORMAT ========================
  fmt(v, pad) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number') {
      if (!isFinite(v)) return v > 0 ? '∞' : '-∞';
      if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toString();
      if (Math.abs(v) > 1e10 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(6);
      const s = v.toPrecision(8).replace(/\.?0+$/, '');
      return pad ? s.padStart(pad) : s;
    }
    return String(v);
  },
};

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => OS.init());
