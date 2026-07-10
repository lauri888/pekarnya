const menuItems = Array.from(document.querySelectorAll("[data-item]"));
let orderItem = document.querySelector("[data-order-item]");
const total = document.querySelector("[data-order-total]");
const form = document.querySelector("[data-order-form]");
const status = document.querySelector("[data-form-status]");
const submitButton = document.querySelector("[data-order-submit]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const sectionLinks = Array.from(document.querySelectorAll('a[href^="#"]'));

let selectedPrice = Number(menuItems[0]?.dataset.price || 0);

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea"));
}

function setSubmitState(isLoading) {
  if (!submitButton) {
    return;
  }

  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Готовим бриф..." : "Скопировать бриф";
}

function getEndpointConfig() {
  if (!form) {
    return { url: "", type: "" };
  }

  return {
    url: form.dataset.orderEndpoint?.trim() || "",
    type: form.dataset.orderEndpointType?.trim() || "webhook",
  };
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 11;
}

function updateTotal() {
  if (!total) {
    return;
  }

  total.textContent = "Стоимость после согласования";
}

function setOrderIdea(value) {
  if (!orderItem || !value) {
    return;
  }

  if (orderItem.tagName === "SELECT") {
    const matchingOption = Array.from(orderItem.options).find((option) => option.value === value);
    if (matchingOption) {
      orderItem.value = value;
    } else {
      orderItem.value = "Хочу обсудить идею";
    }
    return;
  }

  orderItem.value = value;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.left = "-999px";
  document.body.append(helper);
  helper.select();
  const copied = document.execCommand("copy");
  helper.remove();
  return copied;
}

function createOrderBrief(payload) {
  return [
    "Здравствуйте! Хочу обсудить индивидуальный заказ.",
    `Что заказать: ${payload.item}`,
    `На сколько человек: ${payload.guests}`,
    `Повод: ${payload.occasion}`,
    `Дата и время: ${payload.pickup}`,
    `Бюджет: ${payload.budget}`,
    `Имя: ${payload.name}`,
    `Телефон: ${payload.phone}`,
    payload.comment ? `Пожелания: ${payload.comment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function createProductDetailsMarkup(item) {
  return `
    <div class="menu-item-details" data-item-details aria-hidden="true">
      <div class="menu-item-details-inner">
        <div class="product-card-top">
          <span class="card-kicker">Подробности позиции</span>
          <strong>${item.dataset.item}</strong>
          <p>${item.dataset.note}</p>
        </div>

        <div class="product-stats">
          <div>
            <span>Вес</span>
            <strong>${item.dataset.weight}</strong>
          </div>
          <div>
            <span>Цена</span>
            <strong>${item.dataset.price} ₽</strong>
          </div>
          <div>
            <span>КБЖУ</span>
            <strong>${item.dataset.kcal}</strong>
          </div>
        </div>

        <div class="product-macros" aria-label="Пищевая ценность">
          <div><span>Белки</span><strong>${item.dataset.protein}</strong></div>
          <div><span>Жиры</span><strong>${item.dataset.fat}</strong></div>
          <div><span>Углеводы</span><strong>${item.dataset.carbs}</strong></div>
        </div>

        <dl class="product-meta">
          <div>
            <dt>Состав</dt>
            <dd>${item.dataset.compose}</dd>
          </div>
          <div>
            <dt>Когда лучше забрать</dt>
            <dd>${item.dataset.bake}</dd>
          </div>
          <div>
            <dt>С чем взять</dt>
            <dd>${item.dataset.pairing}</dd>
          </div>
        </dl>

        <button class="button primary product-order-link" type="button" data-order-link>
          Обсудить похожий заказ
        </button>
      </div>
    </div>
  `;
}

function updateItemHint(item, isSelected) {
  const hint = item.querySelector("[data-item-hint]");
  if (!hint) {
    return;
  }

  hint.textContent = isSelected ? "Меню открыто" : "Открыть меню";
}

function hydrateOrderItemControl() {
  if (!orderItem || orderItem.tagName !== "INPUT") {
    return orderItem;
  }

  const select = document.createElement("select");
  select.name = orderItem.name;
  select.dataset.orderItem = "";

  menuItems.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.dataset.item;
    option.textContent = item.dataset.item;
    select.append(option);
  });

  select.value = orderItem.value || menuItems[0]?.dataset.item || "";
  orderItem.replaceWith(select);
  orderItem = select;

  return select;
}

function hydrateMenuItems() {
  menuItems.forEach((item) => {
    const copy = item.querySelector(".menu-item-copy");
    const price = copy?.querySelector("strong");

    if (copy && price && !copy.querySelector(".menu-item-footer")) {
      const footer = document.createElement("div");
      footer.className = "menu-item-footer";

      const hint = document.createElement("span");
      hint.className = "menu-item-hint";
      hint.dataset.itemHint = "";
      hint.textContent = "Открыть меню";

      footer.append(price, hint);
      copy.append(footer);
    }

    if (!item.querySelector("[data-item-details]")) {
      item.insertAdjacentHTML("beforeend", createProductDetailsMarkup(item));
    }

    const orderLink = item.querySelector("[data-order-link]");
    orderLink?.addEventListener("click", (event) => {
      event.stopPropagation();
      selectItem(item, true);
    });

    item.setAttribute("aria-expanded", "false");
  });
}

function selectItem(item, shouldScroll = false) {
  menuItems.forEach((entry) => {
    const details = entry.querySelector("[data-item-details]");

    entry.classList.remove("selected");
    entry.setAttribute("aria-pressed", "false");
    entry.setAttribute("aria-expanded", "false");
    details?.setAttribute("aria-hidden", "true");
    updateItemHint(entry, false);
  });

  item.classList.add("selected");
  item.setAttribute("aria-pressed", "true");
  item.setAttribute("aria-expanded", "true");
  item.querySelector("[data-item-details]")?.setAttribute("aria-hidden", "false");
  updateItemHint(item, true);

  setOrderIdea(item.dataset.item);

  selectedPrice = Number(item.dataset.price || 0);
  updateTotal();

  if (shouldScroll) {
    document.querySelector("#order")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function collapseItem(item) {
  const details = item.querySelector("[data-item-details]");

  item.classList.remove("selected");
  item.setAttribute("aria-pressed", "false");
  item.setAttribute("aria-expanded", "false");
  details?.setAttribute("aria-hidden", "true");
  updateItemHint(item, false);
}

function toggleItem(item, shouldScroll = false) {
  if (item.classList.contains("selected")) {
    collapseItem(item);
    return;
  }

  selectItem(item, shouldScroll);
}

function closeMenu() {
  if (!menuToggle || !nav) {
    return;
  }

  nav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

function highlightTarget(target) {
  if (!target) {
    return;
  }

  target.classList.remove("section-anchor-highlight");

  window.requestAnimationFrame(() => {
    target.classList.add("section-anchor-highlight");
  });

  window.setTimeout(() => {
    target.classList.remove("section-anchor-highlight");
  }, 950);
}

function updateActiveNavLink() {
  const sections = Array.from(document.querySelectorAll("section[id]"));
  const scrollMarker = window.scrollY + 160;

  let activeId = "";

  sections.forEach((section) => {
    if (section.offsetTop <= scrollMarker) {
      activeId = section.id;
    }
  });

  if (!activeId && sections[0]) {
    activeId = sections[0].id;
  }

  sectionLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) {
      return;
    }

    link.classList.toggle("is-active", href === `#${activeId}`);
  });
}

function toggleMenu() {
  if (!menuToggle || !nav) {
    return;
  }

  const isOpen = nav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("menu-open", isOpen);
}

hydrateMenuItems();

menuItems.forEach((item) => {
  collapseItem(item);
});

menuItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    toggleItem(item, false);
  });

  item.addEventListener("keydown", (event) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleItem(item, false);
    }
  });
});

sectionLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href") || "";
    const target = href === "#top" ? document.querySelector("main") : document.querySelector(href);

    if (!target) {
      return;
    }

    event.preventDefault();
    closeMenu();
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      highlightTarget(target);
      updateActiveNavLink();
    }, 260);
  });
});

if (menuToggle) {
  menuToggle.addEventListener("click", toggleMenu);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
});

window.addEventListener("scroll", updateActiveNavLink, { passive: true });

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const pickup = String(formData.get("pickup") || "").trim();
    const guests = Math.max(1, Number(formData.get("guests")) || 1);
    const occasion = String(formData.get("occasion") || "").trim();
    const budget = String(formData.get("budget") || "").trim();
    const comment = String(formData.get("comment") || "").trim();
    const endpoint = getEndpointConfig();

    if (!name || !phone || !pickup) {
      if (status) {
        status.textContent = "Заполните имя, телефон и удобную дату, чтобы можно было быстро обсудить заказ.";
      }
      return;
    }

    if (!isValidPhone(phone)) {
      if (status) {
        status.textContent = "Проверьте номер телефона. Лучше указать его в формате +7 900 000-00-00.";
      }
      return;
    }

    if (status) {
      status.textContent = "";
    }

    setSubmitState(true);

    const payload = {
      item: orderItem?.value || "",
      guests,
      occasion,
      pickup,
      budget,
      name,
      phone,
      comment,
      total: "after_call",
      source: "site",
      endpointType: endpoint.type,
      submittedAt: new Date().toISOString(),
    };

    try {
      if (!endpoint.url) {
        const brief = createOrderBrief(payload);
        const copied = await copyText(brief);

        if (status) {
          status.textContent = copied
            ? "Бриф скопирован. Теперь позвоните в пекарню или отправьте этот текст в Telegram/WhatsApp."
            : "Бриф готов, но браузер не дал скопировать текст. Можно позвонить в пекарню и продиктовать детали из формы.";
        }
        return;
      }

      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      if (status) {
        status.textContent = `Готово: ${name}, бриф «${payload.item}» сохранен. Теперь можно позвонить в пекарню и согласовать оплату.`;
      }

      form.reset();

      const defaultItem = document.querySelector(".menu-item.selected") || menuItems[0];
      if (defaultItem instanceof HTMLElement) {
        selectItem(defaultItem, false);
      }
    } catch (error) {
      if (status) {
        status.textContent =
          "Не удалось сохранить бриф во внешний канал. Можно скопировать детали из формы и позвонить в пекарню.";
      }
    } finally {
      setSubmitState(false);
    }
  });
}

updateTotal();
updateActiveNavLink();
