import {
  Component,
  escapeHtmlContent,
  escapeHtmlAttr,
} from "../modules/ui.mjs";

export function createContactList(data) {
  return new Component({
    element: "#contacts",
    data,
    template(data) {
      return `<ul>
            ${
              data?.addressBook != null
                ? Object.keys(data.contacts)
                    .map((id) => {
                      const { name, email } = data.addressBook.contacts[id];
                      return `<li class="contact-row" draggable="true" data-id="${escapeHtmlAttr(
                        id
                      )}">
                      <p class="contact-row__name">
                        ${escapeHtmlContent(name)}
                      </p>
                      <p class="contact-row__email">
                        ${
                          email != null
                            ? escapeHtmlContent(email)
                            : '<span class="no-email">No email available</span>'
                        }
                      </p>
                  </li>`;
                    })
                    .join("\n")
                : ""
            }
            </ul>`;
    },
  });
}
