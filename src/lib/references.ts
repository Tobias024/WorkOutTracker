// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Referencias de papers usadas en los tooltips ⓘ de métricas. IDs = numeración
 * del spec Asset/spec-metricas-por-objetivo.md (sección Referencias).
 * `short` = etiqueta clickeable (autor-año); `cite` = referencia completa.
 */
export const REFERENCES: Record<
  string,
  { short: string; cite: string; url: string }
> = {
  "1": {
    short: "Schoenfeld 2017",
    cite: "Schoenfeld, Ogborn, Krieger 2017 — volumen semanal e hipertrofia",
    url: "https://pubmed.ncbi.nlm.nih.gov/27433992/",
  },
  "2": {
    short: "Sueño y entrenamiento (2024)",
    cite: "Restricción de sueño y adaptaciones al entrenamiento",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11390164/",
  },
  "3": {
    short: "Precisión de fórmulas de 1RM",
    cite: "Precisión de las ecuaciones de predicción de 1RM",
    url: "https://journal.iusca.org/index.php/Journal/article/view/327",
  },
  "4": {
    short: "Schoenfeld 2021",
    cite: "Schoenfeld et al. 2021 — cargas para fuerza/hipertrofia/resistencia",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7927075/",
  },
  "5": {
    short: "Descanso autoseleccionado",
    cite: "Descanso autoseleccionado vs fijo",
    url: "https://sportrxiv.org/index.php/server/preprint/view/975",
  },
  "6": {
    short: "Autorregulación por RIR",
    cite: "Autorregulación por RIR (Helms; Graham & Cleather)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7706636/",
  },
  "7": {
    short: "Baz-Valle 2021",
    cite: "Baz-Valle et al. 2021 — series totales como medida de volumen",
    url: "https://doi.org/10.1519/JSC.0000000000002776",
  },
  "8": {
    short: "Refalo 2023",
    cite: "Refalo et al. 2023 — proximidad al fallo e hipertrofia",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9935748/",
  },
  "9": {
    short: "Steele 2017",
    cite: "Steele et al. 2017 — precisión al predecir reps al fallo",
    url: "https://peerj.com/articles/4105/",
  },
  "10": {
    short: "Halperin 2022",
    cite: "Halperin et al. 2022 — predicción de reps al fallo",
    url: "https://link.springer.com/article/10.1007/s40279-021-01559-x",
  },
  "11": {
    short: "Schoenfeld 2016 (frecuencia)",
    cite: "Schoenfeld et al. 2016 — frecuencia e hipertrofia",
    url: "https://doi.org/10.1007/s40279-016-0543-8",
  },
  "12": {
    short: "Schoenfeld 2019 (frecuencia)",
    cite: "Schoenfeld et al. 2019 — frecuencia por músculo",
    url: "https://doi.org/10.1080/02640414.2018.1555906",
  },
  "13": {
    short: "Resistencia local (meta-análisis)",
    cite: "Resistencia muscular local en adultos (meta-análisis)",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S016749432300033X",
  },
  "14": {
    short: "Reps por serie y resistencia",
    cite: "Reps totales por serie y resistencia muscular local",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0765159722000405",
  },
  "15": {
    short: "ACSM 2021 (descanso)",
    cite: "ACSM 2021 — recomendaciones de descanso por objetivo",
    url: "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1549609/full",
  },
  "16": {
    short: "Pelland 2026 (dosis-respuesta)",
    cite: "Pelland, Remmert, Robinson, Hinson, Zourdos 2026 — meta-regresión de volumen y frecuencia (67 estudios): las series indirectas cuentan 0,5",
    url: "https://doi.org/10.1007/s40279-025-02344-w",
  },
  "17": {
    short: "Vigotsky 2022 (EMG)",
    cite: "Vigotsky, Halperin, Trajano, Vieira 2022 — la amplitud de EMG no es un predictor validado de hipertrofia",
    url: "https://doi.org/10.1007/s40279-021-01619-2",
  },
  "18": {
    short: "MacDougall 1995 (SPM)",
    cite: "MacDougall et al. 1995 — curso temporal de la síntesis proteica muscular tras entrenamiento de fuerza",
    url: "https://doi.org/10.1139/h95-038",
  },
  "19": {
    short: "Robinson 2024",
    cite: "Robinson, Pelland, Remmert, Refalo, Jukic, Steele, Zourdos 2024 — meta-regresión de proximidad al fallo: la hipertrofia mejora al acercarse, pero para fuerza la pendiente del RIR es nula",
    url: "https://doi.org/10.1007/s40279-024-02069-2",
  },
  rp: {
    short: "Renaissance Periodization",
    cite: "Renaissance Periodization — volume landmarks",
    url: "https://rpstrength.com/expert-advice/training-volume-landmarks-muscle-growth",
  },
};
