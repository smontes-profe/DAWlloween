/**
 * @file app.js
 * @description Single Page Application (SPA) State Router and application orchestrator.
 * Manages hash-based client-side routing, view lifecycle (mount / unmount),
 * active navigation state, and decoupled communication via the Event Bus.
 * Follows strict UK English (en-GB) naming conventions and pedagogical clean architecture.
 */

import { eventBus } from './utils/eventBus.js';
import { alerts } from './ui/alerts.js';
import { welcomeView } from './views/welcomeView.js';
import { gameView } from './views/gameView.js';
import { screamerView } from './views/screamerView.js';

/**
 * Client-side State Router managing view transitions and component lifecycles.
 */
export class Router {
  /**
   * Initialise router with mount target and route configuration.
   *
   * @param {Object} [options={}] - Router configuration options.
   * @param {string|HTMLElement} [options.mountSelector='#app'] - Target container for mounting views.
   * @param {string} [options.defaultRoute='#home'] - Fallback route when hash is empty or unmatched.
   */
  constructor(options = {}) {
    this.mountSelector = options.mountSelector || '#app';
    this.defaultRoute = options.defaultRoute || '#home';
    this.routes = new Map();
    this.currentRoute = null;
    this.activeView = null;
    this.boundHashChangeHandler = null;
    this.mountContainer = null;
  }

  /**
   * Register a route hash and its associated view definition.
   *
   * @param {string} routeHash - Route hash identifier (e.g. '#home', '#play').
   * @param {Object|Function} viewHandler - View object with mount/unmount lifecycle, or factory function.
   * @returns {Router} The router instance for fluent chaining.
   * @throws {TypeError} If routeHash is invalid or viewHandler is missing.
   */
  register(routeHash, viewHandler) {
    if (typeof routeHash !== 'string' || !routeHash.startsWith('#')) {
      throw new TypeError('Router: routeHash must be a string starting with "#".');
    }
    if (!viewHandler) {
      throw new TypeError('Router: viewHandler must be provided.');
    }

    this.routes.set(routeHash.toLowerCase(), viewHandler);
    return this;
  }

  /**
   * Resolve and ensure the DOM mount container element.
   *
   * @returns {HTMLElement|null} The resolved DOM element.
   */
  getMountContainer() {
    if (typeof document === 'undefined') {
      return null;
    }

    if (!this.mountContainer || !document.body.contains(this.mountContainer)) {
      if (typeof this.mountSelector === 'string') {
        this.mountContainer = document.querySelector(this.mountSelector);
      } else if (this.mountSelector instanceof HTMLElement) {
        this.mountContainer = this.mountSelector;
      }
    }
    return this.mountContainer;
  }

  /**
   * Programmatically navigate to a route hash.
   *
   * @param {string} routeHash - Target route hash (e.g. '#play').
   */
  navigate(routeHash) {
    if (typeof window !== 'undefined') {
      window.location.hash = routeHash;
    } else {
      this.handleRouteChange(routeHash);
    }
  }

  /**
   * Normalise and resolve the current hash from the browser location.
   *
   * @param {string} [explicitHash] - Optional explicit hash override for programmatic or test invocation.
   * @returns {string} Sanitised route hash.
   */
  resolveHash(explicitHash) {
    let rawHash = explicitHash;
    if (rawHash === undefined && typeof window !== 'undefined') {
      rawHash = window.location.hash;
    }

    if (!rawHash || rawHash === '#' || rawHash.trim() === '') {
      return this.defaultRoute;
    }

    const cleanHash = rawHash.split('?')[0].trim().toLowerCase();
    return this.routes.has(cleanHash) ? cleanHash : this.defaultRoute;
  }

  /**
   * Synchronise navigation links with active route and accessibility attributes.
   *
   * @param {string} activeRoute - Current active route hash.
   */
  synchroniseNavigation(activeRoute) {
    if (typeof document === 'undefined') {
      return;
    }

    const navLinks = document.querySelectorAll('.site-nav .nav-link');
    for (const link of navLinks) {
      const href = link.getAttribute('href');
      if (href && href.toLowerCase() === activeRoute) {
        link.classList.add('nav-link--active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('nav-link--active');
        link.removeAttribute('aria-current');
      }
    }
  }

  /**
   * Handle route transition lifecycle:
   * 1. Teardown / unmount outgoing view.
   * 2. Clear mount container.
   * 3. Instantiate and mount incoming view.
   * 4. Synchronise navigation header.
   * 5. Dispatch navigation event via Event Bus.
   *
   * @param {string} [explicitHash] - Optional explicit hash for route processing.
   * @returns {Promise<boolean>} True if view was mounted successfully; false otherwise.
   */
  async handleRouteChange(explicitHash) {
    const targetRoute = this.resolveHash(explicitHash);
    const previousRoute = this.currentRoute;

    // Avoid duplicate transition to the same active route
    if (targetRoute === this.currentRoute && this.activeView) {
      return true;
    }

    const container = this.getMountContainer();
    if (!container) {
      return false;
    }

    // 1. Teardown outgoing view lifecycle
    if (this.activeView) {
      if (typeof this.activeView.unmount === 'function') {
        try {
          await this.activeView.unmount();
        } catch (error) {
          console.error(`[Router] Error unmounting view for route "${previousRoute}":`, error);
        }
      }
      this.activeView = null;
    }

    // 2. Clear previous view DOM
    container.innerHTML = '';

    // 3. Resolve incoming view definition
    const viewDefinition = this.routes.get(targetRoute);
    if (!viewDefinition) {
      return false;
    }

    try {
      let viewInstance = viewDefinition;
      if (typeof viewDefinition === 'function') {
        viewInstance = viewDefinition();
      }

      // If view returns a promise (async factory or lazy import)
      if (viewInstance instanceof Promise) {
        viewInstance = await viewInstance;
      }

      if (viewInstance && typeof viewInstance.mount === 'function') {
        await viewInstance.mount(container);
        this.activeView = viewInstance;
      } else if (viewInstance instanceof HTMLElement) {
        container.appendChild(viewInstance);
        this.activeView = { unmount: () => container.removeChild(viewInstance) };
      }

      this.currentRoute = targetRoute;

      // 4. Synchronise header navigation highlights
      this.synchroniseNavigation(targetRoute);

      // 5. Notify observers through the Event Bus
      if (eventBus && typeof eventBus.publish === 'function') {
        eventBus.publish('router:navigate', {
          currentRoute: targetRoute,
          previousRoute
        });
      }

      return true;
    } catch (error) {
      console.error(`[Router] Error mounting view for route "${targetRoute}":`, error);
      return false;
    }
  }

  /**
   * Initialise router lifecycle and attach browser hash change listeners.
   */
  initialise() {
    if (typeof window !== 'undefined') {
      this.boundHashChangeHandler = () => this.handleRouteChange();
      window.addEventListener('hashchange', this.boundHashChangeHandler);

      // Initial route dispatch on load
      this.handleRouteChange();
    }
  }

  /**
   * Detach router event listeners and cleanly unmount active view.
   */
  destroy() {
    if (typeof window !== 'undefined' && this.boundHashChangeHandler) {
      window.removeEventListener('hashchange', this.boundHashChangeHandler);
      this.boundHashChangeHandler = null;
    }

    if (this.activeView && typeof this.activeView.unmount === 'function') {
      this.activeView.unmount();
      this.activeView = null;
    }

    if (this.mountContainer) {
      this.mountContainer.innerHTML = '';
    }
  }
}

/**
 * Creates a semantic placeholder view until concrete view modules are implemented.
 *
 * @param {string} routeName - Name of the view.
 * @param {string} description - Brief summary of upcoming view capabilities.
 * @returns {Object} A view component with mount and unmount lifecycle hooks.
 */
function createPlaceholderView(routeName, description) {
  return {
    mount(container) {
      const section = document.createElement('section');
      section.className = 'container panel-surface';
      section.style.margin = '2rem auto';
      section.style.textAlign = 'center';

      const title = document.createElement('h2');
      title.className = 'text-display text-pumpkin';
      title.textContent = routeName;

      const desc = document.createElement('p');
      desc.className = 'text-muted';
      desc.textContent = description;

      section.appendChild(title);
      section.appendChild(desc);
      container.appendChild(section);
    },
    unmount() {
      // Cleanup hook for placeholder
    }
  };
}

/**
 * Configure default application routes supporting all project views.
 *
 * @param {Router} router - The router instance to populate.
 */
export function registerApplicationRoutes(router) {
  router
    .register('#home', welcomeView)
    .register('#play', gameView)
    .register('#screamer', screamerView)
    .register('#register', createPlaceholderView('Register Hall of Fame', 'Review captured reaction and register your nickname.'))
    .register('#hall-of-fame', createPlaceholderView('Hall of Fame', 'Public responsive wall showcasing survivor reactions.'));
}

/**
 * Application orchestrator singleton instance.
 */
export const appRouter = new Router({
  mountSelector: '#app',
  defaultRoute: '#home'
});

/**
 * Application bootstrapper.
 */
export function initialiseApp() {
  registerApplicationRoutes(appRouter);
  appRouter.initialise();
}

// Auto-boot if running in browser context
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialiseApp);
  } else {
    initialiseApp();
  }
}

export default appRouter;
