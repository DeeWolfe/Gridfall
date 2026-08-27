// Side-effecting: installs the DOM stub the moment it is imported.
//
// Import order is what matters here. ES module imports are all evaluated
// before any statement in the importing file runs, so calling installDom()
// from a test body would be too late for src/save/store.js, which probes
// localStorage at import time. Importing this module FIRST fixes the order.
import {installDom} from './dom.js';

installDom();
