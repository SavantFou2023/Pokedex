const generationInfo = window.POKEDEX_GENERATION;
const generationNumber = Number(generationInfo);
const isGlobalSearch = generationInfo === "all" || Number.isNaN(generationNumber);

const audio = document.getElementById("audio");
const slider = document.getElementById("volumeSlider");
const muteBtn = document.getElementById("muteBtn");
const playBtn = document.getElementById("playBtn");
const volumeContainer = document.querySelector(".volume-container");
const grid = document.getElementById("grid");
const searchInput = document.querySelector(".search-bar");
const searchStatus = document.getElementById("searchStatus");
const detailOverlay = document.getElementById("detailOverlay");
const detailClose = document.getElementById("detailClose");

// Éléments spécifiques à la page principale
const generationGrid = document.getElementById("generationGrid");
const pokemonSection = document.getElementById("pokemonSection");

const generationRanges = [
  { gen: 1, start: 1, end: 151 },
  { gen: 2, start: 152, end: 251 },
  { gen: 3, start: 252, end: 386 },
  { gen: 4, start: 387, end: 493 },
  { gen: 5, start: 494, end: 649 },
  { gen: 6, start: 650, end: 721 },
  { gen: 7, start: 722, end: 809 },
  { gen: 8, start: 810, end: 905 },
  { gen: 9, start: 906, end: 1025 },
];

let pokemonList = [];
let pokemonDetailsLoaded = false;
let isSearchActive = false;

function setSearchStatus(text) {
  if (searchStatus) {
    searchStatus.textContent = text;
  }
}

const statNames = {
  hp: "PV",
  attack: "Attaque",
  defense: "Défense",
  "special-attack": "Attaque Spé",
  "special-defense": "Défense Spé",
  speed: "Vitesse",
};

slider.addEventListener("input", function () {
  audio.volume = this.value;
});

playBtn.addEventListener("click", function () {
  if (audio.paused) {
    audio.play();
    playBtn.textContent = "⏸️";
  } else {
    audio.pause();
    playBtn.textContent = "▶️";
  }
});

muteBtn.addEventListener("click", function () {
  audio.muted = !audio.muted;
  muteBtn.textContent = audio.muted ? "🔇" : "🔊";
});

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

volumeContainer.addEventListener("mousedown", (event) => {
  isDragging = true;
  volumeContainer.classList.add("dragging");
  document.body.classList.add("dragging");
  offsetX = event.clientX - volumeContainer.offsetLeft;
  offsetY = event.clientY - volumeContainer.offsetTop;
});

document.addEventListener("mousemove", (event) => {
  if (!isDragging) return;

  volumeContainer.style.left = event.clientX - offsetX + "px";
  volumeContainer.style.top = event.clientY - offsetY + "px";
  volumeContainer.style.right = "auto";
  volumeContainer.style.bottom = "auto";
});

document.addEventListener("mouseup", () => {
  isDragging = false;
  volumeContainer.classList.remove("dragging");
  document.body.classList.remove("dragging");
});

function getIdFromUrl(url) {
  return Number(url.match(/\/(\d+)\/$/)?.[1]);
}

async function loadPokemon() {
  try {
    let speciesList = [];

    if (isGlobalSearch) {
      const generationPromises = Array.from({ length: 9 }, (_, index) =>
        fetch(`https://pokeapi.co/api/v2/generation/${index + 1}`).then((res) => res.json())
      );

      const generationData = await Promise.all(generationPromises);
      speciesList = generationData.flatMap((data, index) =>
        data.pokemon_species.map((species) => ({
          id: getIdFromUrl(species.url),
          englishName: species.name,
          generation: index + 1,
        }))
      );
    } else {
      const res = await fetch(`https://pokeapi.co/api/v2/generation/${generationNumber}`);
      const data = await res.json();

      speciesList = data.pokemon_species.map((species) => ({
        id: getIdFromUrl(species.url),
        englishName: species.name,
        generation: generationNumber,
      }));
    }

    speciesList = speciesList
      .filter((pokemon) => pokemon.id)
      .sort((a, b) => a.id - b.id);

    pokemonList = speciesList.map((pokemon) => createPokemonCard(pokemon));

    await updateFrenchNames();

    if (isGlobalSearch) {
      setSearchStatus(`Chargement des données Pokémon... ${pokemonList.length} Pokémon détectés.`);
      loadAllDetails();
    } else {
      setSearchStatus(`Affichage des Pokémon de la génération ${generationNumber}. Tapez pour rechercher.`);
    }
  } catch (err) {
    console.error("Erreur chargement Pokémon :", err);
    grid.innerHTML = `<p class="detail-error">Impossible de charger les Pokémon de cette génération.</p>`;
  }
}

function createPokemonCard(pokemon) {
  const container = document.createElement("div");
  container.classList.add("pokemon-card");
  container.dataset.id = pokemon.id;
  container.dataset.generation = pokemon.generation || getGenerationFromId(pokemon.id);
  container.dataset.name = pokemon.englishName;
  container.dataset.searchName = pokemon.englishName.toLowerCase();
  container.dataset.englishName = pokemon.englishName;
  container.dataset.types = "";
  container.dataset.weight = "";
  container.dataset.height = "";
  container.dataset.abilities = "";

  const img = document.createElement("img");
  img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
  img.alt = pokemon.englishName;

  const meta = document.createElement("div");
  meta.className = "pokemon-meta";
  const number = document.createElement("span");
  number.className = "pokemon-number";
  number.textContent = `#${String(pokemon.id).padStart(3, "0")}`;
  const generationTag = document.createElement("span");
  generationTag.className = "pokemon-gen";
  generationTag.textContent = `Gen ${container.dataset.generation}`;
  meta.append(number, generationTag);

  const name = document.createElement("p");
  name.textContent = pokemon.englishName;

  const typesElement = document.createElement("div");
  typesElement.className = "pokemon-types";
  typesElement.textContent = "Chargement...";

  container.appendChild(img);
  container.appendChild(meta);
  container.appendChild(name);
  container.appendChild(typesElement);
  grid.appendChild(container);

  return container;
}

function getGenerationFromId(id) {
  const numericId = Number(id);
  return generationRanges.find((range) => numericId >= range.start && numericId <= range.end)?.gen || 0;
}

async function loadAllDetails() {
  const concurrency = 16;
  const total = pokemonList.length;

  for (let start = 0; start < total; start += concurrency) {
    const batch = pokemonList.slice(start, start + concurrency).map(async (card) => {
      const id = card.dataset.id;
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const pokemon = await res.json();
        const types = pokemon.types.map((type) => formatTypeName(type.type.name)).join(" ");
        const abilities = pokemon.abilities
          .map((ability) => ability.ability.name.replace(/-/g, " "))
          .map((name) => name.charAt(0).toUpperCase() + name.slice(1))
          .join(" ");

        card.dataset.types = types.toLowerCase();
        card.dataset.weight = (pokemon.weight * 0.1).toFixed(1);
        card.dataset.height = (pokemon.height * 0.1).toFixed(1);
        card.dataset.abilities = abilities.toLowerCase();

        // Mettre à jour l'affichage des types dans la carte
        const typesElement = card.querySelector(".pokemon-types");
        if (typesElement) {
          typesElement.textContent = types;
        }
      } catch (err) {
        console.warn(`Impossible de charger les détails pour #${id}:`, err);
      }
    });
    await Promise.all(batch);
    setSearchStatus(`Chargement des données Pokémon... ${Math.min(start + concurrency, total)}/${total}`);
  }

  pokemonDetailsLoaded = true;
  setSearchStatus(`Recherche prête sur ${total} Pokémon de toutes les générations.`);
}

async function updateFrenchNames() {
  const concurrency = 12;

  for (let start = 0; start < pokemonList.length; start += concurrency) {
    const batch = pokemonList.slice(start, start + concurrency).map(async (card) => {
      try {
        const id = card.dataset.id;
        const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const species = await speciesRes.json();
        const frenchName = species.names.find((name) => name.language.name === "fr")?.name;

        if (frenchName) {
          card.dataset.name = frenchName;
          card.dataset.searchName = frenchName.toLowerCase();
          card.querySelector("p").textContent = frenchName;
        }
      } catch (err) {
        console.warn(`Impossible de récupérer le nom français pour #${card.dataset.id}:`, err);
      }
    });

    await Promise.all(batch);
  }
}

async function fetchFrenchName(species) {
  return species.names.find((entry) => entry.language.name === "fr")?.name || species.name;
}

function formatTypeName(type) {
  const map = {
    normal: "Normal",
    fire: "Feu",
    water: "Eau",
    grass: "Plante",
    electric: "Électrik",
    ice: "Glace",
    fighting: "Combat",
    poison: "Poison",
    ground: "Sol",
    flying: "Vol",
    psychic: "Psy",
    bug: "Insecte",
    rock: "Roche",
    ghost: "Spectre",
    dark: "Ténèbres",
    dragon: "Dragon",
    steel: "Acier",
    fairy: "Fée",
  };

  return map[type] || type;
}

function showDetailOverlay() {
  detailOverlay.classList.remove("hidden");
  detailOverlay.classList.add("visible");
  detailOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideDetailOverlay() {
  detailOverlay.classList.remove("visible");
  detailOverlay.classList.add("hidden");
  detailOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function showPokemonDetail(id) {
  const content = detailOverlay.querySelector(".detail-content");
  content.innerHTML = `<div class="detail-loader">Chargement du Pokémon...</div>`;
  showDetailOverlay();

  try {
    const [pokemonRes, speciesRes] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
    ]);

    const pokemon = await pokemonRes.json();
    const species = await speciesRes.json();
    const frenchName = await fetchFrenchName(species);

    const types = pokemon.types.map((type) => formatTypeName(type.type.name)).join(" / ");

    const abilities = pokemon.abilities
      .map((ability) => ability.ability.name.replace(/-/g, " "))
      .map((name) => name.charAt(0).toUpperCase() + name.slice(1));

    const statsHtml = pokemon.stats
      .map((stat) => {
        const label = statNames[stat.stat.name] || stat.stat.name;
        return `<div class="stat-row"><span>${label}</span><strong>${stat.base_stat}</strong></div>`;
      })
      .join("");

    const forms = species.varieties
      .filter((variety) => variety.pokemon.name !== species.name)
      .map((variety) => variety.pokemon.name.replace(/-/g, " "));

    const formHtml = forms.length
      ? forms.map((item) => `<li>${item}</li>`).join("")
      : "<li>Aucune forme alternative connue</li>";

    const height = (pokemon.height * 0.1).toFixed(1);
    const weight = (pokemon.weight * 0.1).toFixed(1);

    content.innerHTML = `
      <div class="detail-header">
        <div class="detail-sprites">
          <img src="${pokemon.sprites.front_default}" alt="${frenchName} normal" />
          <img src="${pokemon.sprites.front_shiny}" alt="${frenchName} shiny" class="shiny" />
        </div>
        <div>
          <h2 id="detailTitle">${frenchName}</h2>
          <p class="detail-number">#${String(id).padStart(3, "0")}</p>
          <p><strong>Types :</strong> ${types}</p>
          <p><strong>Taille :</strong> ${height} m</p>
          <p><strong>Poids :</strong> ${weight} kg</p>
        </div>
      </div>
      <div class="detail-columns">
        <div class="detail-block">
          <h3>Statistiques</h3>
          <div class="stats-list">${statsHtml}</div>
        </div>
        <div class="detail-block">
          <h3>Talents</h3>
          <ul>${abilities.map((ability) => `<li>${ability}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="detail-block full-width">
        <h3>Formes alternatives</h3>
        <ul>${formHtml}</ul>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p class="detail-error">Impossible de charger les informations. Réessayez plus tard.</p>`;
    console.error("Erreur détail Pokémon :", err);
  }
}

grid.addEventListener("click", (event) => {
  const card = event.target.closest(".pokemon-card");
  if (!card) return;
  showPokemonDetail(card.dataset.id);
});

detailClose.addEventListener("click", hideDetailOverlay);
detailOverlay.addEventListener("click", (event) => {
  if (event.target === detailOverlay) {
    hideDetailOverlay();
  }
});

if (searchInput) {
  searchInput.addEventListener("input", async () => {
    const rawValue = searchInput.value.trim().toLowerCase();
    const terms = rawValue.split(/\s+/).filter(Boolean);

    // Si on commence à taper et que les Pokémon ne sont pas encore chargés
    if (terms.length > 0 && !isSearchActive) {
      isSearchActive = true;
      if (generationGrid) generationGrid.style.display = "none";
      if (pokemonSection) pokemonSection.style.display = "block";

      // Charger tous les Pokémon si ce n'est pas déjà fait
      if (pokemonList.length === 0) {
        await loadPokemon();
      }
    }

    // Si la recherche est vide, revenir à la grille des générations
    if (terms.length === 0 && isSearchActive) {
      isSearchActive = false;
      if (generationGrid) generationGrid.style.display = "grid";
      if (pokemonSection) pokemonSection.style.display = "none";
      setSearchStatus("Recherche sur toutes les générations. Tapez pour chercher.");
      return;
    }

    // Si pas en mode recherche active, ne rien faire
    if (!isSearchActive) return;

    let visibleCount = 0;

    pokemonList.forEach((pokemon) => {
      const searchable = [
        pokemon.dataset.searchName,
        pokemon.dataset.name,
        pokemon.dataset.englishName,
        pokemon.dataset.id,
        pokemon.dataset.generation,
        pokemon.dataset.types,
        pokemon.dataset.weight,
        pokemon.dataset.height,
        pokemon.dataset.abilities,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const isMatch = terms.length === 0 || terms.every((term) => searchable.includes(term));
      const nameEl = pokemon.querySelector("p");
      const displayName = pokemon.dataset.name || pokemon.dataset.englishName;

      if (isMatch) {
        pokemon.classList.remove("hidden");
        visibleCount++;

        if (terms.length && nameEl) {
          let highlighted = displayName;
          terms.forEach((term) => {
            const regex = new RegExp(`(${term})`, "gi");
            highlighted = highlighted.replace(regex, "<mark>$1</mark>");
          });
          nameEl.innerHTML = highlighted;
        } else if (nameEl) {
          nameEl.textContent = displayName;
        }
      } else {
        pokemon.classList.add("hidden");
        if (nameEl) {
          nameEl.textContent = displayName;
        }
      }
    });

    setSearchStatus(
      rawValue
        ? `${visibleCount} résultat(s) pour « ${rawValue} »`
        : `Recherche sur ${pokemonList.length} Pokémon. Tapez un nom, type, poids, génération ou numéro.`
    );
  });
}

// Ne charger les Pokémon automatiquement que sur les pages de génération
// Sur la page principale, ils se chargent seulement lors d'une recherche
if (!generationGrid) {
  loadPokemon();
}
