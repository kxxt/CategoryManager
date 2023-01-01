// -------------------
// Native Context Menu
// -------------------

import { createDispatcherForContactListContextMenu } from "../modules/context-menu.mjs";
import {
  addContactsToComposeDetails,
  toRFC5322EmailAddress,
} from "../modules/contact.mjs";
import { lookupContactsByCategoryElement } from "./utils.mjs";
import { id2contact, SUBCATEGORY_SEPARATOR } from "../modules/address-book/index.mjs";
import {
  createMenuForCategoryTree,
  createMenuForContact,
  destroyAllMenus,
} from "../modules/context-menu.mjs";
import { getCategoryStringFromInput } from "./modal.mjs";
import {
  addContactToCategory,
  removeContactFromCategory,
} from "./category-edit.mjs";

function makeCategoryMenuHandler(fieldName, state) {
  return async () => {
    const contacts = lookupContactsByCategoryElement(
      state.elementForContextMenu
    );
    if (state.isComposeAction) {
      await addContactsToComposeDetails(fieldName, state.tab, contacts);
    } else {
      // Do a filterMap(using a flatMap) to remove contacts that do not have an email address
      // and map the filtered contacts to rfc 5322 email address format.
      const emailList = Object.keys(contacts).flatMap((c) => {
        const contact = id2contact(state.currentAddressBook, c);
        return contact.email == null ? [] : [toRFC5322EmailAddress(contact)];
      });
      await browser.compose.beginNew(null, { [fieldName]: emailList });
    }
    window.close();
  };
}

function overrideMenuForCategoryTree() {
  destroyAllMenus();
  createMenuForCategoryTree();
}

function overrideMenuForContactList(state) {
  destroyAllMenus();
  createMenuForContact(
    state.currentAddressBook,
    state.elementForContextMenu.dataset.id
  );
}

const contextMenuHandlers = {
  add_to: makeCategoryMenuHandler("to"),
  add_cc: makeCategoryMenuHandler("cc"),
  add_bcc: makeCategoryMenuHandler("bcc"),
};

export function initContextMenu(state, updateUI) {
  const dispatchMenuEventsForContactList =
    createDispatcherForContactListContextMenu({
      async onDeletion(categoryStr) {
        const contactId = state.elementForContextMenu.dataset.id;
        const addressBookId = state.elementForContextMenu.dataset.addressbook;
        const addressBook = state.addressBooks.get(addressBookId);
        const category = categoryStr.split(SUBCATEGORY_SEPARATOR);
        await removeContactFromCategory({
          addressBook,
          contactId,
          category,
          virtualAddressBook: state.allContactsVirtualAddressBook,
        });
        return updateUI();
      },
      async onAddition(categoryStr, createSubCategory) {
        const contactId = state.elementForContextMenu.dataset.id;
        const addressBookId = state.elementForContextMenu.dataset.addressbook;
        const addressBook = state.addressBooks.get(addressBookId);
        if (createSubCategory) {
          const subcategory = await getCategoryStringFromInput();
          if (subcategory == null) return;
          if (categoryStr === "") categoryStr = subcategory;
          else categoryStr += ` / ${subcategory}`;
        }
        const category = categoryStr.split(SUBCATEGORY_SEPARATOR);
        await addContactToCategory({
          addressBook,
          contactId,
          category,
          virtualAddressBook: state.allContactsVirtualAddressBook,
        });
        return updateUI();
      },
    });

  document.addEventListener("contextmenu", (e) => {
    browser.menus.overrideContext({ context: "tab", tabId: state.tab.id });
    state.elementForContextMenu = e.target;
    console.log(state.elementForContextMenu);
    // Check if the right click originates from contact list
    if (state.elementForContextMenu.parentNode.dataset.id != null) {
      // Right click on contact info
      state.elementForContextMenu = state.elementForContextMenu.parentNode;
      overrideMenuForContactList(state);
      return;
    } else if (state.elementForContextMenu.dataset.id != null) {
      overrideMenuForContactList(state);
      return;
    }
    overrideMenuForCategoryTree();
    // Check if the right click originates from category tree
    if (state.elementForContextMenu.nodeName === "I")
      // Right click on the expander icon. Use the parent element
      state.elementForContextMenu = state.elementForContextMenu.parentNode;
    if (state.elementForContextMenu.dataset.category == null)
      // No context menu outside category tree
      e.preventDefault();
  });

  browser.menus.onClicked.addListener(async ({ menuItemId }, tab) => {
    const handler = contextMenuHandlers[menuItemId];
    if (handler != null) {
      handler();
    } else {
      dispatchMenuEventsForContactList(menuItemId);
    }
  });
}
