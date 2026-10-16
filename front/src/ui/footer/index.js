import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logoPlayStation from "../../assets/logo-playstation-blanc.svg";
import template from "./template.html?raw";

// FooterView est un composant sans données, comme HeaderView.
let FooterView = {
  html: function () {
    return genericRenderer(template, { logoPlayStation });
  },

  dom: function () {
    return htmlToFragment(FooterView.html());
  },
};

export { FooterView };
