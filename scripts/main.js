import { EncounterGeneratorForm, MODULE_ID } from "./encounter-generator-form.js";

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = {
    openGenerator: () => new EncounterGeneratorForm().render(true),
  };

  game.settings.registerMenu(MODULE_ID, "open-generator", {
    name: "PF2EEncounterGenerator.Settings.OpenName",
    hint: "PF2EEncounterGenerator.Settings.OpenHint",
    label: "PF2EEncounterGenerator.Button",
    icon: "fas fa-dice-d20",
    type: EncounterGeneratorForm,
    restricted: true,
  });
});

Hooks.on("renderActorDirectory", (app, html) => {
  injectLaunchButton(app, html);
});

Hooks.on("renderSidebarTab", (app, html) => {
  injectLaunchButton(app, html);
});

function injectLaunchButton(app, html) {
  if (!game.user.isGM || game.system.id !== "pf2e") return;
  if (!isActorSidebar(app)) return;

  const root = resolveRootElement(html);
  if (!root || root.querySelector(".pf2e-encounter-generator-launch")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pf2e-encounter-generator-launch";
  button.innerHTML = `<i class="fas fa-dice-d20"></i> ${game.i18n.localize("PF2EEncounterGenerator.Button")}`;
  button.addEventListener("click", () => new EncounterGeneratorForm().render(true));

  const footer = root.querySelector(".directory-footer");
  const actionButtons = root.querySelector(".action-buttons");
  const header = root.querySelector("header, .directory-header");

  if (footer) {
    footer.prepend(button);
    return;
  }

  if (actionButtons) {
    actionButtons.prepend(button);
    return;
  }

  if (header?.parentElement) {
    header.parentElement.insertBefore(button, header.nextSibling);
    return;
  }

  root.prepend(button);
}

function isActorSidebar(app) {
  return app?.tabName === "actors" || app?.options?.collection === game.actors || app?.collection === game.actors;
}

function resolveRootElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  if (html.element instanceof HTMLElement) return html.element;
  if (html.element?.[0] instanceof HTMLElement) return html.element[0];
  return null;
}
