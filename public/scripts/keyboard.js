/* All selectors that should act as interactables / keyboard buttons by default */
const interactableSelectors = [
    '.interactable', // Main interactable class for ALL interactable controls (can also be manually added in code, so that's why its listed here)
    '.custom_interactable', // Manually made interactable controls via code (see 'makeKeyboardInteractable()')
    '.menu_button', // General menu button in ST
    '.right_menu_button', // Button-likes in many menus
    '.drawer-icon', // Main "menu bar" icons
    '.inline-drawer-icon', // Buttons/icons inside the drawer menus
    '.paginationjs-pages li a', // Pagination buttons
    '.group_select, .character_select, .bogus_folder_select', // Cards to select char, group or folder in character list and other places
    '.swipe_picker_block', // Swipe picker entries in the swipe history popup
    '.avatar-container', // Persona list blocks
    '.tag .tag_remove', // Remove button in removable tags
    '.bg_example', // Background elements in the background menu
    '.bg_example .jg-button, .bg_example .mobile-only-menu-toggle', // The inline buttons on the backgrounds
    '#options a', // Option entries in the popup options menu
    '.mes_buttons .mes_button', // Small inline buttons on the chat messages
    '.extraMesButtons>div:not(.mes_button)', // The extra/extension buttons inline on the chat messages
    '.swipe_left, .swipe_right', // Swipe buttons on the last message
    '.stscript_btn', // STscript buttons in the chat bar
    '.select2_choice_clickable+span.select2-container .select2-selection__choice__display', // select2 control elements if they are meant to be clickable
    '.avatar_load_preview', // Char display avatar selection
    '.bg_tabs_list .bg_tab_button', // Background tabs
    '.select_chat_block', // The blocks to select a past chat in the past chats menu
    '.select_chat_block .exportRawChatButton', // Export raw chat button in the past chats menu
    '.select_chat_block .exportChatButton', // Export chat button in the past chats menu
    '.select_chat_block .PastChat_cross', // Delete chat button in the past chats menu
    '.select_chat_block .renameChatButton', // The button to rename a past chat in the past chats menu
];

if (CSS.supports('selector(:has(*))')) {
    // Option entries in the extension menu popup that are coming from extensions
    interactableSelectors.push('#extensionsMenu div:has(.extensionsMenuExtensionButton)');
}

export const INTERACTABLE_CONTROL_CLASS = 'interactable';
export const CUSTOM_INTERACTABLE_CONTROL_CLASS = 'custom_interactable';

export const NOT_FOCUSABLE_CONTROL_CLASS = 'not_focusable';
export const DISABLED_CONTROL_CLASS = 'disabled';

const KEYBOARD_BASE_RELEVANT_CLASSES = [
    INTERACTABLE_CONTROL_CLASS,
    CUSTOM_INTERACTABLE_CONTROL_CLASS,
    NOT_FOCUSABLE_CONTROL_CLASS,
    DISABLED_CONTROL_CLASS,
    'scroll-reset-container',
];
const KEYBOARD_SELECTOR_CLASS_TOKEN_REGEX = /\.([^\s.,>+~:#[\]()'"]+)/g;

let combinedInteractableSelector = '';
/** @type {Set<string>} */
let relevantKeyboardClasses = new Set();
let hasComplexClassAttributeSelector = false;

/**
 * Rebuilds the combined selector string and extracts all class tokens referenced
 * anywhere in interactableSelectors (including ancestor combinators like `.mes_buttons .mes_button`).
 */
function rebuildKeyboardSelectorIndex() {
    combinedInteractableSelector = interactableSelectors.join(', ');
    const nextClasses = new Set(KEYBOARD_BASE_RELEVANT_CLASSES);
    let complexClassAttr = false;

    for (const selector of interactableSelectors) {
        if (/\[\s*class\b/i.test(selector)) {
            complexClassAttr = true;
        }
        for (const match of selector.matchAll(KEYBOARD_SELECTOR_CLASS_TOKEN_REGEX)) {
            if (match[1]) {
                nextClasses.add(match[1]);
            }
        }
    }

    relevantKeyboardClasses = nextClasses;
    hasComplexClassAttributeSelector = complexClassAttr;
}

rebuildKeyboardSelectorIndex();

const KEYBOARD_FULL_SCAN_THRESHOLD = 40;
const KEYBOARD_PENDING_QUEUE_CAP = 512;
/** @type {Set<Element>} */
const pendingKeyboardNodes = new Set();
let pendingFullBodyScan = false;
let keyboardFlushScheduled = false;
/** @type {WeakSet<Element>} */
const initializedScrollResetContainers = new WeakSet();

/**
 * Enqueues a mutated element for next-frame keyboard scanning while bounding memory
 * retention when requestAnimationFrame is paused in background tabs.
 * @param {Element} node
 */
function enqueuePendingKeyboardNode(node) {
    if (pendingFullBodyScan) {
        return;
    }
    if (node === document.body || pendingKeyboardNodes.size >= KEYBOARD_PENDING_QUEUE_CAP) {
        pendingFullBodyScan = true;
        pendingKeyboardNodes.clear();
        return;
    }
    pendingKeyboardNodes.add(node);
}

/**
 * Computes the lowest common ancestor Element for a non-empty list of connected elements.
 * @param {Element[]} elements
 * @returns {Element|null}
 */
function findLowestCommonAncestor(elements) {
    if (elements.length === 0) {
        return null;
    }
    /** @type {Element[]} */
    const chain = [];
    /** @type {Element|null} */
    let cursor = elements[0];
    while (cursor) {
        chain.push(cursor);
        cursor = cursor.parentElement;
    }

    const chainIndex = new Map(chain.map((el, idx) => [el, idx]));
    let candidateIndex = 0;

    for (let i = 1; i < elements.length; i++) {
        /** @type {Element|null} */
        let node = elements[i];
        let matchedIndex = -1;
        while (node) {
            const idx = chainIndex.get(node);
            if (idx !== undefined) {
                matchedIndex = idx;
                break;
            }
            node = node.parentElement;
        }
        if (matchedIndex === -1) {
            return null;
        }
        if (matchedIndex > candidateIndex) {
            candidateIndex = matchedIndex;
            if (candidateIndex === chain.length - 1) {
                break;
            }
        }
    }

    return chain[candidateIndex] ?? null;
}

/**
 * Schedules a single animation-frame pass to initialize queued DOM subtrees.
 */
function scheduleKeyboardNodeFlush() {
    if (keyboardFlushScheduled) {
        return;
    }
    keyboardFlushScheduled = true;
    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 16);
    schedule(flushPendingKeyboardNodes);
}

/**
 * Processes queued DOM nodes once per frame, collapsing ancestors first and bounding
 * high-cardinality bursts to their lowest common ancestor subtree.
 */
function flushPendingKeyboardNodes() {
    keyboardFlushScheduled = false;
    const forceBodyScan = pendingFullBodyScan;
    pendingFullBodyScan = false;

    if (forceBodyScan) {
        pendingKeyboardNodes.clear();
        if (document.body) {
            handleNodeChange(document.body);
        }
        return;
    }

    if (pendingKeyboardNodes.size === 0) {
        return;
    }

    /** @type {Element[]} */
    const connectedNodes = [];
    for (const node of pendingKeyboardNodes) {
        if (node.isConnected) {
            connectedNodes.push(node);
        }
    }
    pendingKeyboardNodes.clear();

    if (connectedNodes.length === 0) {
        return;
    }

    if (document.body && connectedNodes.includes(document.body)) {
        handleNodeChange(document.body);
        return;
    }

    const rootSet = new Set(connectedNodes);
    /** @type {Element[]} */
    const roots = [];
    for (const node of connectedNodes) {
        let ancestor = node.parentElement;
        let coveredByAncestor = false;
        while (ancestor) {
            if (rootSet.has(ancestor)) {
                coveredByAncestor = true;
                break;
            }
            ancestor = ancestor.parentElement;
        }
        if (!coveredByAncestor) {
            roots.push(node);
        }
    }

    if (roots.length > KEYBOARD_FULL_SCAN_THRESHOLD) {
        const scanRoot = findLowestCommonAncestor(roots) ?? document.body;
        if (scanRoot) {
            handleNodeChange(scanRoot);
        }
        return;
    }

    for (const root of roots) {
        handleNodeChange(root);
    }
}

/**
 * Checks whether a class mutation added or removed any class referenced by keyboard
 * interactable selectors (including ancestor classes), focus-inhibiting state classes,
 * or scroll-reset containers.
 * @param {Element} target
 * @param {string|null} oldValue
 * @returns {boolean}
 */
function hasRelevantKeyboardClassChanged(target, oldValue) {
    if (hasComplexClassAttributeSelector || typeof oldValue !== 'string') {
        return true;
    }

    const prevSet = new Set(oldValue.split(/\s+/).filter(Boolean));
    for (const prevClass of prevSet) {
        if (relevantKeyboardClasses.has(prevClass) && !target.classList.contains(prevClass)) {
            return true;
        }
    }

    const currentClassName = typeof target.className === 'string'
        ? target.className
        : (target.getAttribute('class') ?? '');
    for (const currClass of currentClassName.split(/\s+/).filter(Boolean)) {
        if (relevantKeyboardClasses.has(currClass) && !prevSet.has(currClass)) {
            return true;
        }
    }

    return false;
}

/**
 * An observer that will check if any new interactables or scroll reset containers are added to the body
 * @type {MutationObserver}
 */
const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === Node.ELEMENT_NODE && addedNode instanceof Element) {
                    enqueuePendingKeyboardNode(addedNode);
                }
            }
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            if (target instanceof Element) {
                if (target.closest('#chat') && !hasRelevantKeyboardClassChanged(target, mutation.oldValue)) {
                    continue;
                }
                enqueuePendingKeyboardNode(target);
            }
        }
    }

    if (pendingFullBodyScan || pendingKeyboardNodes.size > 0) {
        scheduleKeyboardNodeFlush();
    }
});

/**
 * Function to handle node changes (added or modified nodes)
 * @param {Element} node
 */
function handleNodeChange(node) {
    if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
        // Handle keyboard interactables
        if (isKeyboardInteractable(node)) {
            makeKeyboardInteractable(node);
        }
        initializeInteractables(node);

        // Handle scroll reset containers
        if (node.classList.contains('scroll-reset-container')) {
            applyScrollResetBehavior(node);
        }
        initializeScrollResetBehaviors(node);
    }
}

/**
 * Registers an interactable class (for example for an extension) and makes it keyboard interactable.
 * Optionally apply the 'not_focusable' and 'disabled' classes if needed.
 *
 * @param {string} interactableSelector - The CSS selector for the interactable (Supports class combinations, chained via dots like <c>tag.actionable</c>, and sub selectors)
 * @param {object} [options={}] - Optional settings for the interactable
 * @param {boolean} [options.disabledByDefault=false] - Whether interactables of this class should be disabled by default
 * @param {boolean} [options.notFocusableByDefault=false] - Whether interactables of this class should not be focusable by default
 */
export function registerInteractableType(interactableSelector, { disabledByDefault = false, notFocusableByDefault = false } = {}) {
    interactableSelectors.push(interactableSelector);
    rebuildKeyboardSelectorIndex();

    const interactables = document.querySelectorAll(interactableSelector);

    if (disabledByDefault || notFocusableByDefault) {
        interactables.forEach(interactable => {
            if (disabledByDefault) interactable.classList.add(DISABLED_CONTROL_CLASS);
            if (notFocusableByDefault) interactable.classList.add(NOT_FOCUSABLE_CONTROL_CLASS);
        });
    }

    makeKeyboardInteractable(...interactables);
}

/**
 * Checks if the given control is a keyboard-enabled interactable.
 *
 * @param {Element} control - The control element to check
 * @returns {boolean} Returns true if the control is a keyboard interactable, false otherwise
 */
export function isKeyboardInteractable(control) {
    // Check if this control matches any of the selectors
    return control.matches(combinedInteractableSelector);
}

/**
 * Makes all the given controls keyboard interactable and sets their state.
 * If the control doesn't have any of the classes, it will be set to a custom-enabled keyboard interactable.
 *
 * @param {Element[]} interactables - The controls to make interactable and set their state
 */
export function makeKeyboardInteractable(...interactables) {
    interactables.forEach(interactable => {
        // If this control doesn't have any of the classes, lets say the caller knows this and wants this to be a custom-enabled keyboard control.
        if (!isKeyboardInteractable(interactable)) {
            interactable.classList.add(CUSTOM_INTERACTABLE_CONTROL_CLASS);
        }

        // Just for CSS styling and future reference, every keyboard interactable control should have a common class
        if (!interactable.classList.contains(INTERACTABLE_CONTROL_CLASS)) {
            interactable.classList.add(INTERACTABLE_CONTROL_CLASS);
        }

        /**
         * Check if the element or any parent element has 'disabled' or 'not_focusable' class
         * @param {Element} el
         * @returns {boolean}
         */
        const hasDisabledOrNotFocusableAncestor = (el) => {
            while (el) {
                if (el.classList.contains(NOT_FOCUSABLE_CONTROL_CLASS) || el.classList.contains(DISABLED_CONTROL_CLASS)) {
                    return true;
                }
                el = el.parentElement;
            }
            return false;
        };

        // Set/remove the tabindex accordingly to the classes. Remembering if it had a custom value.
        if (!hasDisabledOrNotFocusableAncestor(interactable)) {
            if (!interactable.hasAttribute('tabindex')) {
                const tabIndex = interactable.getAttribute('data-original-tabindex') ?? '0';
                interactable.setAttribute('tabindex', tabIndex);
            }
        } else {
            interactable.setAttribute('data-original-tabindex', interactable.getAttribute('tabindex'));
            interactable.removeAttribute('tabindex');
        }
    });
}

/**
 * Initializes the focusability of controls on the given element or the document
 *
 * @param {Element|Document} [element=document] - The element on which to initialize the interactable state. Defaults to the document.
 */
function initializeInteractables(element = document) {
    const interactables = getAllInteractables(element);
    makeKeyboardInteractable(...interactables);
}

/**
 * Queries all interactables within the given element based on the given selectors and returns them as an array
 *
 * @param {Element|Document} element - The element within which to query the interactables
 * @returns {HTMLElement[]} An array containing all the interactables that match the given selectors
 */
function getAllInteractables(element) {
    return Array.from(element.querySelectorAll(combinedInteractableSelector));
}

/**
 * Function to apply scroll reset behavior to a container
 * @param {Element} container - The container
 */
const applyScrollResetBehavior = (container) => {
    if (initializedScrollResetContainers.has(container)) {
        return;
    }
    initializedScrollResetContainers.add(container);

    container.addEventListener('focusout', () => {
        setTimeout(() => {
            const focusedElement = document.activeElement;
            if (!container.contains(focusedElement)) {
                container.scrollTop = 0;
                container.scrollLeft = 0;
            }
        }, 0);
    });
};

/**
 * Initializes the scroll reset behavior on the given element or the document
 *
 * @param {Element|Document} [element=document] - The element on which to initialize the scroll reset behavior. Defaults to the document.
 */
function initializeScrollResetBehaviors(element = document) {
    const scrollResetContainers = element.querySelectorAll('.scroll-reset-container');
    scrollResetContainers.forEach(container => applyScrollResetBehavior(container));
}

/**
 * Handles keydown events on the document to trigger click on Enter key press for interactables
 *
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleGlobalKeyDown(event) {
    if (event.key === 'Enter') {
        if (!(event.target instanceof HTMLElement))
            return;

        // Only count enter on this interactable if no modifier key is pressed
        if (event.altKey || event.ctrlKey || event.shiftKey)
            return;

        // Traverse up the DOM tree to find the actual interactable element
        let target = event.target;
        while (target && !isKeyboardInteractable(target)) {
            target = target.parentElement;
        }

        // Trigger click if a valid interactable is found and it's not disabled
        if (target && !target.classList.contains(DISABLED_CONTROL_CLASS)) {
            console.debug('Triggering click on keyboard-focused interactable control via Enter', target);
            target.click();
        }
    }
}

/**
 * Initializes several keyboard functionalities for ST
 */
export function initKeyboard() {
    // Start observing the body for added elements and attribute changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class'],
    });

    // Initialize already existing controls
    initializeInteractables();
    initializeScrollResetBehaviors();

    // Add a global keydown listener
    document.addEventListener('keydown', handleGlobalKeyDown);
}
