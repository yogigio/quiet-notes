// Toolbar button toggles the notes sidebar. sidebarAction.toggle() only
// works while handling direct user input, so this must stay synchronous.
browser.action.onClicked.addListener(() => {
  browser.sidebarAction.toggle();
});
