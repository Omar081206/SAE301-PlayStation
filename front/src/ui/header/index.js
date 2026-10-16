import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logoSony from "../../assets/logo-sony.svg";
import logoPlayStation from "../../assets/logo-playstation.svg";
import template from "./template.html?raw";

// HeaderView est un composant sans données : son template ne reçoit que les
// adresses des logos, calculées par Vite au build.
let HeaderView = {
  html: function () {
    return genericRenderer(template, { logoSony, logoPlayStation });
  },

  dom: function () {
    return htmlToFragment(HeaderView.html());
  },
};

export { HeaderView };
