// All content in this file is invented for tests. None of it is copied from a
// real recipe site.
const finnishGraph: unknown = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Keittiö Esimerkki" },
    {
      "@type": ["Recipe", "NewsArticle"],
      name: "Mansikka &amp; vanilja panna cotta",
      inLanguage: "fi-FI",
      recipeYield: "4 annosta",
      recipeIngredient: [
        "4 dl kermaa",
        "1 dl sokeria",
        "  ",
        "3 liivatelehteä",
      ],
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Panna cotta",
          itemListElement: [
            { "@type": "HowToStep", text: "Liota liivatteet." },
            { "@type": "HowToStep", text: "Kuumenna <b>kerma</b>." },
          ],
        },
        {
          "@type": "HowToSection",
          name: "Kastike",
          itemListElement: [{ "@type": "HowToStep", name: "Soseuta marjat." }],
        },
      ],
      nutrition: {
        "@type": "NutritionInformation",
        servingSize: "1 annos",
        calories: "412 kcal",
        sugarContent: "12,5 g",
        fatContent: "30 g",
      },
    },
  ],
};

const englishMainEntity: unknown = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  mainEntity: {
    "@type": "Recipe",
    name: "Weekday Waffles",
    recipeYield: ["8", "8 waffles"],
    recipeIngredient: ["2 cups flour", "2 eggs"],
    recipeInstructions: "Mix everything.\nCook in a hot iron.",
  },
};

const noRecipe: unknown = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Ten kitchen tips",
};

export { englishMainEntity, finnishGraph, noRecipe };
