/**
 * @file router.test.js
 * @description Unit tests for Router and SPA navigation lifecycle.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Router, registerApplicationRoutes } from '../src/app.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Lightweight mock DOM environment for router testing.
 */
function createMockDom() {
  class MockNode {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.classList = {
        _classes: new Set(),
        add: (...c) => c.forEach((cls) => this.classList._classes.add(cls)),
        remove: (...c) => c.forEach((cls) => this.classList._classes.delete(cls)),
        contains: (cls) => this.classList._classes.has(cls)
      };
      this.attributes = new Map();
      this.childNodes = [];
      this.parentNode = null;
      this.innerHTML = '';
    }

    setAttribute(key, val) {
      this.attributes.set(key, String(val));
    }

    getAttribute(key) {
      return this.attributes.get(key) || null;
    }

    removeAttribute(key) {
      this.attributes.delete(key);
    }

    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    contains(child) {
      if (!child) return false;
      if (this.childNodes.includes(child)) return true;
      return this.childNodes.some((c) => typeof c.contains === 'function' && c.contains(child));
    }
  }

  const body = new MockNode('BODY');
  const appMount = new MockNode('MAIN');
  appMount.id = 'app';
  body.appendChild(appMount);

  // Nav links
  const navHome = new MockNode('A');
  navHome.className = 'nav-link';
  navHome.setAttribute('href', '#home');

  const navHall = new MockNode('A');
  navHall.className = 'nav-link';
  navHall.setAttribute('href', '#hall-of-fame');

  body.appendChild(navHome);
  body.appendChild(navHall);

  const doc = {
    body,
    createElement: (tag) => new MockNode(tag),
    querySelector: (selector) => {
      if (selector === '#app') return appMount;
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === '.site-nav .nav-link' || selector.includes('.nav-link')) {
        return [navHome, navHall];
      }
      return [];
    }
  };

  const win = {
    location: { hash: '#home' },
    listeners: new Map(),
    addEventListener(evt, fn) {
      if (!this.listeners.has(evt)) this.listeners.set(evt, []);
      this.listeners.get(evt).push(fn);
    },
    removeEventListener(evt, fn) {
      if (this.listeners.has(evt)) {
        const arr = this.listeners.get(evt);
        const idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }
  };

  return { doc, win, appMount, navHome, navHall };
}

describe('Router Unit Tests', () => {
  let mockEnv;
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    mockEnv = createMockDom();
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    globalThis.document = mockEnv.doc;
    globalThis.window = mockEnv.win;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    eventBus.clear();
  });

  it('should register routes and reject invalid route signatures', () => {
    const router = new Router({ defaultRoute: '#home' });
    router.register('#test', { mount: () => {} });

    assert.equal(router.routes.has('#test'), true);

    // Invalid hash format
    assert.throws(() => router.register('noHashPrefix', {}), {
      name: 'TypeError',
      message: /routeHash must be a string starting with "#"/
    });

    // Missing handler
    assert.throws(() => router.register('#missing', null), {
      name: 'TypeError',
      message: /viewHandler must be provided/
    });
  });

  it('should resolve unknown or empty hash to defaultRoute', () => {
    const router = new Router({ defaultRoute: '#home' });
    router.register('#home', { mount: () => {} });
    router.register('#play', { mount: () => {} });

    assert.equal(router.resolveHash(''), '#home');
    assert.equal(router.resolveHash('#'), '#home');
    assert.equal(router.resolveHash('#unknown-path'), '#home');
    assert.equal(router.resolveHash('#play?debug=true'), '#play');
  });

  it('should trigger mount and unmount lifecycle hooks upon navigation', async () => {
    const router = new Router({ mountSelector: '#app', defaultRoute: '#home' });
    const lifecycleLog = [];

    const homeView = {
      mount: (container) => {
        lifecycleLog.push('mount:home');
        const el = document.createElement('div');
        el.id = 'home-view';
        container.appendChild(el);
      },
      unmount: () => {
        lifecycleLog.push('unmount:home');
      }
    };

    const playView = {
      mount: (container) => {
        lifecycleLog.push('mount:play');
        const el = document.createElement('div');
        el.id = 'play-view';
        container.appendChild(el);
      },
      unmount: () => {
        lifecycleLog.push('unmount:play');
      }
    };

    router.register('#home', homeView);
    router.register('#play', playView);

    // Initial route
    await router.handleRouteChange('#home');
    assert.deepEqual(lifecycleLog, ['mount:home']);
    assert.equal(router.currentRoute, '#home');

    // Switch route to #play
    await router.handleRouteChange('#play');
    assert.deepEqual(lifecycleLog, ['mount:home', 'unmount:home', 'mount:play']);
    assert.equal(router.currentRoute, '#play');
  });

  it('should synchronise active navigation classes and aria-current attributes', async () => {
    const router = new Router({ mountSelector: '#app', defaultRoute: '#home' });
    router.register('#home', { mount: () => {} });
    router.register('#hall-of-fame', { mount: () => {} });

    await router.handleRouteChange('#home');
    assert.equal(mockEnv.navHome.classList.contains('nav-link--active'), true);
    assert.equal(mockEnv.navHome.getAttribute('aria-current'), 'page');
    assert.equal(mockEnv.navHall.classList.contains('nav-link--active'), false);
    assert.equal(mockEnv.navHall.getAttribute('aria-current'), null);

    await router.handleRouteChange('#hall-of-fame');
    assert.equal(mockEnv.navHome.classList.contains('nav-link--active'), false);
    assert.equal(mockEnv.navHall.classList.contains('nav-link--active'), true);
    assert.equal(mockEnv.navHall.getAttribute('aria-current'), 'page');
  });

  it('should publish router:navigate event to EventBus on route transitions', async () => {
    const router = new Router({ mountSelector: '#app', defaultRoute: '#home' });
    router.register('#home', { mount: () => {} });
    router.register('#play', { mount: () => {} });

    const navigationEvents = [];
    eventBus.subscribe('router:navigate', (payload) => {
      navigationEvents.push(payload);
    });

    await router.handleRouteChange('#home');
    assert.equal(navigationEvents.length, 1);
    assert.deepEqual(navigationEvents[0], { currentRoute: '#home', previousRoute: null });

    await router.handleRouteChange('#play');
    assert.equal(navigationEvents.length, 2);
    assert.deepEqual(navigationEvents[1], { currentRoute: '#play', previousRoute: '#home' });
  });

  it('should register all expected application routes via registerApplicationRoutes', () => {
    const router = new Router();
    registerApplicationRoutes(router);

    assert.equal(router.routes.has('#home'), true);
    assert.equal(router.routes.has('#play'), true);
    assert.equal(router.routes.has('#screamer'), true);
    assert.equal(router.routes.has('#register'), true);
    assert.equal(router.routes.has('#hall-of-fame'), true);
    assert.equal(router.routes.has('#admin'), true);
  });
});
