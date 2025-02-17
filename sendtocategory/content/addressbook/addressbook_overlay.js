var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

Services.scriptloader.loadSubScript("chrome://sendtocategory/content/category_tools.js");


/* stuff

https://dxr.mozilla.org/comm-central/source/mailnews/addrbook/src/nsAbManager.cpp
Standard field list

https://dxr.mozilla.org/comm-central/source/mailnews/addrbook/src/nsAbDirectoryQuery.cpp#469
CaseInsensitive StringComparison is hardcoded - if two categories with same name but different case -> resultsViewPane will sometimes mix cards, if categories string is equal but just differnt case 





public LDAP Test account
Hostname:ldap.adams.edu
Base DN: ou=people,dc=adams,dc=edu
Port number: 389
Bind DN: LEAVE BLANK
Use secure connection (SSL):UNCHECK


TODO 
 - rename and delete global category should be possible
 - should categories defined in book1 be available in dropdown/popup in book2 ???
 - bring back SCSearchCriteriaButtonMenu
 - store/restore last addressbook used in messenger as well
*/



//###################################################
// adding additional functions to the local jbCatMan Object
//###################################################

jbCatMan.dragdrop = {
  handleEvent(event) {                  
    switch (event.type) {
      case "dragenter":
      case "dragover":
        if (event.dataTransfer.getData("categoryName")) {
          event.preventDefault();
          event.currentTarget.style["background-color"] = "#555555";
        }
        break;

      case "dragleave":
        if (event.dataTransfer.getData("categoryName")) {
          event.currentTarget.style["background-color"] = ""; 
        }
        break;      

      case "drop":
        if (event.dataTransfer.getData("categoryName")) {
          event.preventDefault();
          let destination = event.currentTarget.categoryName;
          let originalName = event.dataTransfer.getData("categoryName");
          let newName = destination + " / " + originalName.split(" / ").slice(-1);
          /* */ jbCatMan.updateCategories("rename", originalName, newName); 
        }
        break;

      
      case "dragstart": 
        if (GetSelectedDirectory() != "moz-abdirectory://?") {
          event.dataTransfer.setData("categoryName", event.currentTarget.categoryName);
        }
        break;
          
      case "dragend": 
        break;
      
      default: 
        return undefined;
    }
  },
};

jbCatMan.addCategoryListEntry = function (abURI, newCategoryName) {
  let newListItem = document.createXULElement("richlistitem");
  newListItem.categoryName = newCategoryName;
  newListItem.subCategories = jbCatMan.getSubCategories(newCategoryName);
  newListItem.categoryFilter = newListItem.subCategories.concat(newCategoryName); // to filter the view
  newListItem.categorySize = jbCatMan.data.categoryMembers[newCategoryName].length;
  newListItem.id = btoa("Category:" + newCategoryName).split("=").join("");
  newListItem.addEventListener("dragenter", jbCatMan.dragdrop);
  newListItem.addEventListener("dragover", jbCatMan.dragdrop);
  newListItem.addEventListener("dragleave", jbCatMan.dragdrop);
  newListItem.addEventListener("dragstart", jbCatMan.dragdrop);
  newListItem.addEventListener("dragend", jbCatMan.dragdrop);
  newListItem.addEventListener("drop", jbCatMan.dragdrop);
  
  let levels = [];
  let categoryLevels = newCategoryName.split(" / ");
  for (let i = 0; i < categoryLevels.length; i++) levels.push("level" + i);
  newListItem.setAttribute("class", levels.join(" "));
  newListItem.setAttribute("isOpen", "false");

  let categoryMore = document.createXULElement("hbox");
  if (newListItem.subCategories.length > 0) {
    categoryMore.setAttribute("class", "twisty");
    categoryMore.addEventListener("click", function(e) { jbCatMan.onClickCategoryList(e); }, false);
  }
  categoryMore.setAttribute("flex", "0");
  categoryMore.style["margin-left"] = ((categoryLevels.length-1) * 16) + "px";
  newListItem.appendChild(categoryMore);
  
  let categoryName = document.createXULElement("label");
  categoryName.setAttribute("flex", "1");
  categoryName.setAttribute("value", categoryLevels[categoryLevels.length-1]);
  newListItem.appendChild(categoryName);
  
  let categorySize = document.createXULElement("label");
  categorySize.setAttribute("flex", "0");
  categorySize.setAttribute("value", newListItem.categorySize);
  newListItem.appendChild(categorySize);
  return newListItem;
}

jbCatMan.toggleCategoryListEntry = function (abURI, element) {
  let categoriesList = document.getElementById("CatManCategoriesList");
  let isOpen = (element.getAttribute("isOpen") == "true");

  if (isOpen) {
    // toggle to closed
    element.setAttribute("isOpen", "false");
    // remove all entries up to the next element with the same level
    while (
      element.nextSibling && 
      element.nextSibling.categoryName && 
      element.nextSibling.categoryName.split(" / ").length > element.categoryName.split(" / ").length) {
        element.nextSibling.remove();
    }
  } else {
    // toggle to open
    element.setAttribute("isOpen", "true");
    // add entries
    let hook = element.nextSibling;

    let reducedCategories = jbCatMan.getReducedCategoriesForHierarchyMode(element.categoryName);    
    for (let subCat of reducedCategories) {
      let newItem = jbCatMan.addCategoryListEntry(abURI, subCat);
      if (newItem) categoriesList.insertBefore(newItem, hook);    
    }
  }
}

jbCatMan.updateCategoryList = function () {
  let abURI = GetSelectedDirectory();
  jbCatMan.scanCategories(abURI);
  
  // Save current open-states.
  let categoriesList = document.getElementById("CatManCategoriesList");
  let openNodes = categoriesList.querySelectorAll('richlistitem[isOpen=true]');  
  let openFilters = [];
  for (let openNode of openNodes) {
    openFilters.push(openNode.id);
  }
   
  // Clear current  list.
  categoriesList.clearSelection();
  for (let i=categoriesList.getRowCount(); i>0; i--) {
    categoriesList.getItemAtIndex(i-1).remove();
  }

  let isGlobal = (abURI == "moz-abdirectory://?");
  let isRemote = (!isGlobal && abURI) 
    ? MailServices.ab.getDirectory(abURI).isRemote
    : false;
  
  // Disable "all" element if global book and global book empty or if remote book.
  if (!isRemote && !(isGlobal && jbCatMan.data.abSize == 0)) {
    let newListItem = document.createXULElement("richlistitem");
    newListItem.categoryFilter = "none";
    newListItem.id = btoa("Default:" + newListItem.categoryFilter).split("=").join("");
    let categoryName = document.createXULElement("label");
    categoryName.setAttribute("flex", "1");
    categoryName.setAttribute("value", jbCatMan.locale.viewAllCategories);
    categoryName.setAttribute("style", "font-style:italic;");
    newListItem.appendChild(categoryName);
    let categorySize = document.createXULElement("label");
    categorySize.setAttribute("flex", "0");
    categorySize.setAttribute("value", jbCatMan.data.abSize);
    categorySize.setAttribute("style", "font-style:italic;");
    newListItem.appendChild(categorySize);
    categoriesList.appendChild(newListItem);
  }
  
  // Add all first level categories.
  let reducedCategories = jbCatMan.getReducedCategoriesForHierarchyMode();    
  for (let subCat of reducedCategories) {
    let newItem = jbCatMan.addCategoryListEntry(abURI, subCat);
    if (newItem) categoriesList.appendChild(newItem);
  }

  // Restore open states.
  for (let openFilter of openFilters) {
    let node = categoriesList.querySelector("#" + openFilter);  
    if (node) {
      jbCatMan.toggleCategoryListEntry(abURI, node);
    }
  }
  
  // Disable "cardsWithoutCategories" element if global book and global book empty or if remote book
  if (!isRemote && !(isGlobal && jbCatMan.data.cardsWithoutCategories.length == 0)) {
    let newListItem = document.createXULElement("richlistitem");
    newListItem.categoryFilter = "uncategorized";
    newListItem.id = btoa("Default:" + newListItem.categoryFilter).split("=").join("");

    let categoryMore = document.createXULElement("hbox");
    categoryMore.setAttribute("flex", "0");
    newListItem.appendChild(categoryMore);
    
    let categoryName = document.createXULElement("label");
    categoryName.setAttribute("flex", "1");
    categoryName.setAttribute("value", jbCatMan.getLocalizedMessage("viewWithoutCategories"));
    categoryName.setAttribute("style", "font-style:italic;");
    newListItem.appendChild(categoryName);
    let categorySize = document.createXULElement("label");
    categorySize.setAttribute("flex", "0");
    categorySize.setAttribute("value", jbCatMan.data.cardsWithoutCategories.length);
    categorySize.setAttribute("style", "font-style:italic;");
    newListItem.appendChild(categorySize);
    categoriesList.appendChild(newListItem);
  }
  
  // Check, if the former selected element still exists and select it again.
  if (jbCatMan.data.selectedCategory) {
    let node = categoriesList.querySelector("#" + jbCatMan.data.selectedCategory);  
    if (node) {
      categoriesList.selectedItem = node;
      
      // Final check: Is the result view pane up to date? This is still not the best way to do it ...
      if (document.getElementById('abResultsTree').view.rowCount != node.categorySize) {
        jbCatMan.doCategorySearch(node.categoryFilter);
      }
      
    } else {
      jbCatMan.data.selectedCategory = null;
      ClearCardViewPane();
      jbCatMan.updatePeopleSearchInput();
      SetAbView(abURI);
      SelectFirstCard();
    }
  }
  
  jbCatMan.updateButtons();
}

jbCatMan.updateContextMenu = function () {
    let categoriesList = document.getElementById("CatManCategoriesList");

    let isAll = (categoriesList.querySelector("#" + jbCatMan.data.selectedCategory).categoryFilter == "none");
    let isUncategorized = (categoriesList.querySelector("#" + jbCatMan.data.selectedCategory).categoryFilter == "uncategorized");
    let selectedBook = GetSelectedDirectory();

    let isGlobal = (selectedBook == "moz-abdirectory://?");
    let isRemote = (!isGlobal && selectedBook) 
      ? MailServices.ab.getDirectory(selectedBook).isRemote
      : false;
  
    document.getElementById("CatManContextMenuRemove").disabled = (isAll || isRemote || isGlobal || isUncategorized);
    document.getElementById("CatManContextMenuRename").disabled = (isAll || isRemote || isGlobal || isUncategorized);
    document.getElementById("CatManContextMenuBulk").disabled = isAll || isRemote || isGlobal || isUncategorized;

    document.getElementById("CatManContextMenuSend").disabled = (isAll || isRemote || isUncategorized); 

    //Import and export for all address books, regardless of category (if no category selected, export entire abook or import without category tagging)
    document.getElementById("CatManContextMenuImportExport").disabled = isRemote || isGlobal;

    if (isAll) {
        document.getElementById("CatManContextMenuImportExport").label = jbCatMan.locale.menuAllExport;
    } else {
        document.getElementById("CatManContextMenuImportExport").label = jbCatMan.locale.menuExport;
    }
  
    let all = isAll ? "_all_" : "_";
}

jbCatMan.updateButtons = function () {
    let selectedBook = GetSelectedDirectory();
    let isGlobal = (selectedBook == "moz-abdirectory://?");
    let isAll = (jbCatMan.data.selectedCategory == null);
    let isRemote = (!isGlobal && selectedBook) 
      ? MailServices.ab.getDirectory(selectedBook).isRemote
      : false;
    document.getElementById("CatManBoxLabel").value = jbCatMan.getLocalizedMessage("found_categories", "");
}


jbCatMan.writeToCategory = async function () {
  let categoriesList = document.getElementById("CatManCategoriesList");

  let searchstring = jbCatMan.getCategorySearchString(GetSelectedDirectory(), categoriesList.querySelector("#" + jbCatMan.data.selectedCategory).categoryFilter);
  let searches = jbCatMan.getSearchesFromSearchString(searchstring);
  let bcc = [];
  for (let search of searches) {
    let cards = await jbCatMan.searchDirectory(search);
    
    for (let card of cards) {
      let email = jbCatMan.getEmailFromCard(card);
      if (email) {
        let entry = card.displayName 
                        ?  "\"" + card.displayName + "\"" + " <" + email + ">"
                        : email;
        bcc.push(entry);
      }
    }
  }
  
  let prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.sendtocategory.");
  let setting = prefs.getCharPref("to_address"); 

  if (bcc.length > 0) {
    let sURL="mailto:";
    //Add envelope addr if specified - or add [ListName] to Subject
    if (setting != "") {
      sURL = sURL + "?to=" + encodeURIComponent(categoriesList.querySelector("#" + jbCatMan.data.selectedCategory).categoryName) + "<" + encodeURIComponent(setting) + ">";
    } else {
      sURL = sURL + "?subject=" + encodeURIComponent("["+ categoriesList.querySelector("#" + jbCatMan.data.selectedCategory).categoryName +"] ");	    
    }
    //Add BCC
    sURL = sURL + "&bcc=" + encodeURIComponent(bcc.join(", "));

    //create the service, the URI and open the new message window via mailServices
    let ioService =  Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);  
    let aURI = ioService.newURI(sURL, null, null);  
    MailServices.compose.OpenComposeWindowWithURI (null, aURI); 
  }
}





//###################################################
// onActions
//###################################################

jbCatMan.onImportExport = function () {
  let categoriesList = document.getElementById("CatManCategoriesList");
  let categoryFilter = categoriesList.querySelector("#" + jbCatMan.data.selectedCategory).categoryFilter;
  window.openDialog("chrome://sendtocategory/content/addressbook/import-export/import-export-wizard.xhtml", "import-export-wizard", "modal,dialog,centerscreen,chrome,resizable=no", categoryFilter);
}



jbCatMan.onHelpButton = function () {
  let ioservice = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
  let uriToOpen = ioservice.newURI("https://github.com/jobisoft/CategoryManager/wiki/F.A.Q.", null, null);
  let extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
  extps.loadURI(uriToOpen, null);
}

jbCatMan.onToggleDisplay = function (show) {
  if (show) {
    document.getElementById('CatManBox').collapsed = false;
    document.getElementById('CatManSplitter').hidden = false;
    document.getElementById('CatManShowBox').hidden = true;
  } else {
    document.getElementById('CatManBox').collapsed = true;
    document.getElementById('CatManSplitter').hidden = true;
    document.getElementById('CatManShowBox').hidden = false;
  }
}

jbCatMan.onSelectAddressbook = function () {
  let selectedBook = GetSelectedDirectory();
  
  if (selectedBook) {
    let prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.sendtocategory.");
    jbCatMan.data.selectedCategory = null;
    jbCatMan.updateCategoryList();
  } else {
    //if for some reason no address book is selected, select the first one
    gDirTree.view.selection.select(0);
    ChangeDirectoryByURI(GetSelectedDirectory());
  }
}


jbCatMan.onClickCategoryList = function (event) {
  let categoriesList = document.getElementById("CatManCategoriesList");
  let abURI = GetSelectedDirectory();

  if (categoriesList.selectedIndex != -1 && categoriesList.selectedItem.subCategories.length > 0) {
    /* */ jbCatMan.toggleCategoryListEntry(abURI, categoriesList.selectedItem);
  }
}

jbCatMan.onSelectCategoryList = function () {
  let categoriesList = document.getElementById("CatManCategoriesList");
  if (categoriesList.selectedIndex != -1) {
    jbCatMan.data.selectedCategory = categoriesList.selectedItem.id;
    jbCatMan.doCategorySearch(categoriesList.selectedItem.categoryFilter);
  }
  jbCatMan.updateButtons();
}



jbCatMan.onPeopleSearchClick = function () {
  jbCatMan.data.selectedCategory = null;
  document.getElementById("CatManCategoriesList").clearSelection();
}

jbCatMan.onBulkEdit = function () {
  //initializing bulkedit-members
  jbCatMan.bulk.needToValidateBulkList = false;
  jbCatMan.bulk.needToSaveBulkList = false;
  jbCatMan.bulk.bulkList = "";
  jbCatMan.bulk.saveList = "";
  jbCatMan.bulk.cardsToBeRemovedFromCategory = [];
  jbCatMan.bulk.selectedDirectory = GetSelectedDirectory();
  
  //all 3 dialogs are called in sequence. Skipped, if canceled.
  let categoriesList = document.getElementById("CatManCategoriesList");
  let categoryFilter = categoriesList.querySelector("#" + jbCatMan.data.selectedCategory).categoryFilter;
  window.openDialog("chrome://sendtocategory/content/addressbook/bulkedit_editAddresses.xhtml", "bulkeditCategory", "modal,centerscreen,chrome,resizable=no", categoryFilter, jbCatMan.locale.bulkTitle);
  if (jbCatMan.bulk.needToValidateBulkList) {
    window.openDialog("chrome://sendtocategory/content/addressbook/bulkedit_validateAddresses.xhtml", "bulkeditCategory", "modal,centerscreen,chrome,width=595,height=600,resizable=yes", categoryFilter, jbCatMan.locale.bulkTitle);
  }
  if (jbCatMan.bulk.needToSaveBulkList) {
    window.openDialog("chrome://sendtocategory/content/addressbook/bulkedit_saveAddresses.xhtml", "bulkeditCategory", "modal,centerscreen,chrome,resizable=yes", categoryFilter, jbCatMan.locale.bulkTitle);
  }
}



jbCatMan.onAddCategory = function (event) {
  let parentCategory = event.target.categoryName;
  event.stopPropagation(); 
  window.openDialog("chrome://sendtocategory/content/addressbook/edit_category.xhtml", "addCategory", "modal,centerscreen,chrome,resizable=no", parentCategory, jbCatMan.locale.addTitle, "add");
}



jbCatMan.onRenameCategory = function () {
  let categoriesList = document.getElementById("CatManCategoriesList");
  if (categoriesList.selectedItem.categoryName) {
    window.openDialog("chrome://sendtocategory/content/addressbook/edit_category.xhtml", "editCategory", "modal,centerscreen,chrome,resizable=no", categoriesList.selectedItem.categoryName, jbCatMan.locale.editTitle, "rename");
  }
}



jbCatMan.onDeleteCategory = function () {
  let categoriesList = document.getElementById("CatManCategoriesList");
  let category = categoriesList.selectedItem.categoryName;
  if (category) {
    // Go through all contacts and remove that category.
    /* */ jbCatMan.updateCategories("remove", category);
  }
}

jbCatMan.addCategoryPopupEntry = function (newCategoryName, cards) {
  let categoryLevels = newCategoryName.split(" / ");
  let itemType = "menu"
  let newItem = document.createXULElement(itemType);
  newItem.setAttribute("class", itemType + "-iconic");
  newItem.setAttribute("label", categoryLevels[categoryLevels.length - 1]);
  newItem.setAttribute("value", newCategoryName);
  newItem.categoryName = newCategoryName;

  let countIn = 0;
  let countOut = 0;  
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].isMailList)
      continue;

    let thisCatsArray = jbCatMan.getCategoriesfromCard(cards[i]);
    if (thisCatsArray.filter(cat => (cat == newCategoryName || cat.startsWith(newCategoryName + " / "))).length > 0) {
      //this card is in this category
      countIn++;
    } else {
      //this card is not in this category
      countOut++;
    }
  }
  
  if (countIn + countOut == 0) {
    // no valid card
    newItem.setAttribute("disabled","true")
  } else if (countIn == 0 ) {
    // all out
    newItem.setAttribute("image", "chrome://sendtocategory/content/skin/checkbox-none.png");
    newItem.addEventListener("click", jbCatMan.onCategoriesContextMenuItemCommand, false);
  } else if (countOut == 0) {
    // all in
    newItem.setAttribute("image", "chrome://sendtocategory/content/skin/checkbox-all.png");
    newItem.addEventListener("click", jbCatMan.onCategoriesContextMenuItemCommand, false);
  } else {
    // mixed
    newItem.setAttribute("image", "chrome://sendtocategory/content/skin/checkbox-some.png");
    newItem.addEventListener("click", jbCatMan.onCategoriesContextMenuItemCommand, false);
    newItem.setAttribute("label", categoryLevels[categoryLevels.length - 1] + " (" + countIn + "/" + (countIn + countOut) + ")");    
  }

  // Add popup for subcategories
  let newPopup = document.createXULElement("menupopup");
  newPopup.categoryName = newCategoryName;
  newItem.appendChild(newPopup);
  
  return newItem;
},

// disable context menu if no card has been selected, or fill context menu with found categories
jbCatMan.onResultsTreeContextMenuPopup = function (event) {
  let cards = GetSelectedAbCards();  
  let abURI = GetSelectedDirectory();

  if (event.target.id == "abResultsTreeContext") {

    let menu = document.getElementById("CatManCategoriesContextMenu");
    menu.disabled = (cards.length == 0);

  } else {

    while (event.target.lastChild) {
      event.target.removeChild(event.target.lastChild);
    }

    // Toplevel has no categoryName and will thus return the list for the first level.
    let reducedCategories = jbCatMan.getReducedCategoriesForHierarchyMode(event.target.categoryName);    
    for (let subCat of reducedCategories) {
      let newItem = jbCatMan.addCategoryPopupEntry(subCat, cards);
      if (newItem) event.target.appendChild(newItem);
    }
    
    // Add "new" entry.
    let newItem = document.createXULElement("menuitem");
    newItem.setAttribute("label", jbCatMan.getLocalizedMessage("createNewCategory"));
    newItem.style["font-style"] = "italic";
    newItem.addEventListener("click", jbCatMan.onAddCategory, false);
    newItem.categoryName = event.target.categoryName;
    event.target.appendChild(newItem);
    
  }
}

jbCatMan.onCategoriesContextMenuItemCommand = function (event) {
  document.getElementById("abResultsTreeContext").hidePopup(); 
  event.stopPropagation(); 

  window.openDialog("chrome://sendtocategory/content/addressbook/catsedit.xhtml", "editCategory", "modal,centerscreen,chrome,resizable=no",  event.target.getAttribute("value"));
}




//###################################################
// event listeners
//###################################################

 /*
  AbListener should detect bulk changes and only call updateCategoryList() after
  the last event. This is achieved by using clearTimeout and setTimeout on each
  event, so if a new event comes in while the timeout for the last one is not yet
  done, it gets postponed.
*/

jbCatMan.AbListenerToUpdateCategoryList = {
  _notifications: [
    "addrbook-contact-created",
    "addrbook-contact-updated",
    "addrbook-contact-deleted",
  ],
  register() {
    for (let topic of this._notifications) {
      Services.obs.addObserver(this, topic);
    }
  },
  unregister() {
    for (let topic of this._notifications) {
      Services.obs.removeObserver(this, topic);
    }
  },
  observe(subject, topic, data) {
    switch (topic) {
      case "addrbook-contact-created":
      case "addrbook-contact-updated":
      case "addrbook-contact-deleted":
        jbCatMan.eventUpdateTimeout.cancel();
        jbCatMan.eventUpdateTimeout.initWithCallback({ notify: function(timer) {jbCatMan.updateCategoryList(); }}, 500, 0);
        break;
    }
  },
};






//###################################################
// init
//###################################################

jbCatMan.paintAddressbook = function() {
  //add categories field to details view
  let CatManCategoriesHeader = document.createXULElement("description");
  CatManCategoriesHeader.id = "CatManCategoriesHeader";
  CatManCategoriesHeader.setAttribute("class", "CardViewHeading");
  CatManCategoriesHeader.textContent = jbCatMan.locale.categories;

  let CatManCategoriesLabel = document.createXULElement("description");
  CatManCategoriesLabel.id= "CatManCategoriesLabel";
  CatManCategoriesLabel.setAttribute("class", "CardViewText");
  CatManCategoriesLabel.CatManCategoriesLabelText = "";
  
  let cvbCategories = document.createXULElement("vbox");
  cvbCategories.id = "cvbCategories";
  cvbCategories.setAttribute("class", "cardViewGroup");
  cvbCategories.setAttribute("CatManUI", "true");
  cvbCategories.appendChild(CatManCategoriesHeader);
  cvbCategories.appendChild(CatManCategoriesLabel);

  let cvbPhone = document.getElementById("cvbPhone");
  cvbPhone.parentNode.insertBefore(cvbCategories, cvbPhone);
  
  // Add listener for card changes to update CategoryList
  jbCatMan.AbListenerToUpdateCategoryList.register();

  // Add listener for action in search input field
  document.getElementById("peopleSearchInput").addEventListener('command', jbCatMan.onPeopleSearchClick , true);

  // Add listener for action in addressbook pane
  document.getElementById("dirTree").addEventListener('select', jbCatMan.onSelectAddressbook, true);

  //Add listener for category context menu in results pane
  document.getElementById("abResultsTreeContext").addEventListener("popupshowing", jbCatMan.onResultsTreeContextMenuPopup, false);

  //Add listener for category context menu in category pane
  document.getElementById("CatManContextMenu").addEventListener("popupshowing", jbCatMan.updateContextMenu , false);
  
  //Add listener for changed selection in results pane, to update CardViewPane
  document.getElementById("abResultsTree").addEventListener("select", jbCatMan.onAbResultsPaneSelectionChanged, false);

  //hide SOGo Categories ContextMenu
  if (document.getElementById("sc-categories-contextmenu")) document.getElementById("sc-categories-contextmenu").style.display = 'none';

  //hide SOGo categories field in CardViewPane
  if (document.getElementById("SCCvCategories")) document.getElementById("SCCvCategories").hidden = true;

  document.getElementById("CatManCategoriesList").addEventListener("dblclick", jbCatMan.writeToCategory, false);
  document.getElementById("CatManCategoriesList").addEventListener("select", jbCatMan.onSelectCategoryList, false);
}

jbCatMan.unpaintAddressbook = function() {
  jbCatMan.AbListenerToUpdateCategoryList.unregister();
  document.getElementById("peopleSearchInput").removeEventListener('command', jbCatMan.onPeopleSearchClick , true);
  document.getElementById("dirTree").removeEventListener('select', jbCatMan.onSelectAddressbook, true);
  document.getElementById("abResultsTreeContext").removeEventListener("popupshowing", jbCatMan.onResultsTreeContextMenuPopup, false);
  document.getElementById("abResultsTree").removeEventListener("select", jbCatMan.onAbResultsPaneSelectionChanged, false);
}  



jbCatMan.onAbResultsPaneSelectionChanged = function () {
  let cards = window.GetSelectedAbCards();

  if (cards.length == 1) {
    let cats = jbCatMan.getCategoriesfromCard(cards[0]).sort().join(", ");
    let CatManCategoriesLabel = document.getElementById("CatManCategoriesLabel");    
    document.getElementById("cvbCategories").collapsed = !cvSetNodeWithLabel(CatManCategoriesLabel, CatManCategoriesLabel.getAttribute("CatManCategoriesLabelText"), cats);
  } else {
    document.getElementById("cvbCategories").collapsed = true;
  }

}