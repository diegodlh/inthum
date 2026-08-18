import { initJsPsych, type PluginInfo, type TrialType } from "jspsych";
import SurveyTextPlugin from "@jspsych/plugin-survey-text";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import AudioButtonResponsePlugin from "@jspsych/plugin-audio-button-response";
import VideoButtonResponsePlugin from "@jspsych/plugin-video-button-response";
import SurveyHtmlFormPlugin from "@jspsych/plugin-survey-html-form";
import PreloadPlugin from "@jspsych/plugin-preload";

import "jspsych/css/jspsych.css";
import "./style.css";

// TODO: we may need trial ids
// TODO: try to remove "any" types
// TODO: add finish shortcut

class Introduction  {
  node: any;
  understood = false;

  constructor(trial: any) {
    const introSubNode = {
      timeline: [
        trial,
        {
          type: HtmlButtonResponsePlugin,
          stimulus: "¿Se entiende esto?",
          choices: [ "SI", "NO" ],
          on_finish: (data: any) => {
            this.understood = data.response == 0; // SI
          }
        }
      ],
      conditional_function: () => !this.understood
    }
    this.node = {
      timeline: [
        {
          timeline: [introSubNode],
          repetitions: 2
        },
        {
          timeline: [{
            type: HtmlButtonResponsePlugin,
            stimulus: "<p>No te preocupes, sigamos. Después de que lea la primera pregunta, avisale a la persona a cargo si todavía no se entiende.</p>",
            choices: [ "CONTINUAR" ]
          }],
          conditional_function: () => !this.understood
        }
      ]
    }
  }
}

let id = "";
let questionnaire = "";
const jsPsych = initJsPsych();

function getBlockTimeline(
  introTrial: any,
  trials: any[],
  testTrials?: any[]
) {
  const timeline = [];
  
  // add block intro
  timeline.push(new Introduction(introTrial).node);

  // add test trials
  if (testTrials) {
    timeline.push(...testTrials);
  }

  // add block trials in random order
  timeline.push(...jsPsych.randomization.shuffle(trials));

  return timeline;
}

function getLikertHtml(choices: string[]) {
  // TODO: check choices length
  const html = `
  <div class="choices">
    ${choices.map((choice, i) => {
      const image = `images/likert_${i}.png`;
      preloadTrial.images.push(image);
      return `
        <label class="choice">
          <input type="radio" name="choice" value="${i}" required>
          <span>${choice}</span>
          <img src="${image}">
        </label>
      `;
    }).join("")}
  </div>
  `;
  return html;
}

const LIKERT_CHOICES: Record<string, string[]> = {
  "similarity": [
    "Nada parecido a mí",
    "Un poco parecido a mí",
    "Más o menos parecido a mí",
    "Muy parecido a mí",
    "Casi exactamente como yo"
  ],
  "frequency": [
    "Nunca",
    "Raramente",
    "A veces",
    "Seguido",
    "Casi siempre"
  ]
}
function getLikertTrial(
  question: string,
  scale: string,
  audioPath?: string
) {
  const trial: TrialType<PluginInfo> = {
    type: SurveyHtmlFormPlugin,
    preamble: `<p>${question}</p>`,
    html: getLikertHtml(LIKERT_CHOICES[scale]),
    button_label: "CONTINUAR",
    on_finish: (data: any) => {
      data.stimulus = question;
    }
  };
  if (scale == "similarity") {
    trial.preamble += "<p>¿Cuánto se parece esto a vos?</p>";
  };
  if (audioPath) {
    preloadTrial.audio.push(audioPath);
    trial.on_load = async () => {
      const form = document.querySelector<HTMLFormElement>(
        "#jspsych-survey-html-form"
      );
      if (!form) return;

      const radioInputs = form.querySelectorAll<HTMLInputElement>(
        'input[type="radio"]'
      );
      const submitButton = form.querySelector<HTMLButtonElement>(
        'input[type="submit"]'
      );

      radioInputs.forEach(input => input.disabled = true);
      if (submitButton) submitButton.disabled = true;

      const audio = await jsPsych.pluginAPI.getAudioPlayer(audioPath);
      audio.play();
      audio.addEventListener("ended", () => {
        radioInputs.forEach(input => input.disabled = false);
        if (submitButton) submitButton.disabled = false;
      });
    };
  };

  return trial;
}

function prependPreamble(preamble: string) {
  const content = document.querySelector("#jspsych-content");
  if (content) {
    const div = document.createElement("div");
    div.className = "preamble";
    div.insertAdjacentHTML("afterbegin", preamble);
    content.prepend(div);
  }
}

function getIntHumTimeline() {
  const QUESTIONS: Record<string, string[]> = {
    "similarity": [
      "Es importante pensar si mis ideas son correctas o equivocadas.",
      "Cuando alguien dice que estoy equivocado, trato de entender por qué piensa que estoy equivocado.",
      "Escucho las ideas de otras personas porque pueden saber cosas que yo no sé.",
      "Cuando resuelvo un problema difícil, aprendo mucho de personas que tienen ideas diferentes a las mías.",
      "Cuando me doy cuenta de que estaba equivocado en algo, cambio de opinión.",
      "Probablemente cambiaría mi idea si aprendo algo nuevo que muestra que estoy equivocado."
    ],
    "frequency": [
      "¿Cuán seguido pensás sobre tus ideas para ver si realmente son correctas?",
      "¿Cuán seguido pensás sobre si tus ideas son correctas o incorrectas?",
      "¿Cuán seguido escuchar las ideas de otras personas te da ideas nuevas?",
      "¿Cuán seguido cambiás de opinión cuando te das cuenta de que estás equivocado?"
    ]
  }

  const timeline = [];

  // add questionnaire intro node
  timeline.push(new Introduction({
    type: AudioButtonResponsePlugin,
    stimulus: `audio/inthum/intro.m4a`,
    choices: [ "CONTINUAR "],
    response_allowed_while_playing: false,
    on_load: () => {
      prependPreamble(`<p>
Los niños y adultos piensan sobre un montón de cosas. Algunas de estas cosas en las que piensan no tienen una respuesta correcta o incorrecta, como por ejemplo cuál es el mejor tipo de fruta.
Pero muchas cosas en las que piensan sí tienen una respuesta correcta o incorrecta, aunque todavía no sepamos cuál es esa respuesta, como qué pasó en un momento particular de la historia, o qué intentan descubrir científicos en sus experimentos.
Este tipo de preguntas tienen respuestas correctas o incorrectas, porque algunas respuestas se basan en mejor información que otras respuestas.
Cuando respondas mis preguntas, quiero que pienses en las cosas que sí tienen una respuesta correcta o incorrecta.
      </p>`);
    }
  }).node);

  // random choose which block will go first
  const block_names = jsPsych.randomization.shuffle(["similarity", "frequency"]);
  for (const [b, block_name] of block_names.entries()) {
    const introTrial = {
      type: VideoButtonResponsePlugin,
      // block intro video depends on both block name and block order
      stimulus: [
        `video/inthum/${block_name}_intro_${b}.mp4`
      ],
      width: 720,
      choices: [ "CONTINUAR" ],
      response_allowed_while_playing: false
    };

    const trials = [];
    const questions = QUESTIONS[block_name];
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const audioPath = `audio/inthum/${block_name}_${i}.m4a`;
      preloadTrial.audio.push(audioPath);
      const trial = getLikertTrial(question, block_name, audioPath);
      trials.push(trial);
    }

    timeline.push(...getBlockTimeline(introTrial, trials));
  }

  return timeline;
}

function getCuriosityTimeline() {
  const QUESTIONS = {
    "similarity": [
      "Hago preguntas para aprender más sobre las cosas.",
      "Me entusiasma aprender cosas nuevas.",
      "Cuando no sé algo, me dan ganas de aprender más.",
      "Cuando algo me sorprende, quiero saber más sobre eso.",
      "Disfruto descubrir cosas nuevas."
    ]
  };

  const timeline = [];

  // add questionnaire intro node
  timeline.push(new Introduction({
    type: AudioButtonResponsePlugin,
    stimulus: `audio/curiosity/intro.m4a`,
    choices: [ "CONTINUAR "],
    response_allowed_while_playing: false,
    on_load: () => {
      prependPreamble(`<p>
Durante este cuestionario, vas a escuchar algunas frases sobre vos, y te voy a pedir que elijas cuánto se parece cada una a vos.
      </p>`);
    }
  }).node);

  // add block
  const block_name = "similarity";
  const introTrial = {
    type: VideoButtonResponsePlugin,
    stimulus: [
      `video/curiosity/${block_name}_intro.mp4`
    ],
    width: 720,
    choices: [ "CONTINUAR" ],
    response_allowed_while_playing: false
  };

  // add test trials
  const testTrials = [];
  testTrials.push(getLikertTrial(
    'Empecemos con una de prueba. Escucha a la siguiente oración: "Me encanta el chocolate".',
    block_name,
    `audio/curiosity/${block_name}_test.m4a`
  ));
  testTrials.push({
    type: HtmlButtonResponsePlugin,
    stimulus: "<p>Ahora sí, ¡empecemos!</p>",
    choices: [ "CONTINUAR" ]
  });

  // add real trials
  const trials = [];
  const questions = QUESTIONS[block_name];
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const audioPath = `audio/curiosity/${block_name}_${i}.m4a`;
    const trial = getLikertTrial(question, block_name, audioPath);
    trials.push(trial);
  }

  timeline.push(...getBlockTimeline(introTrial, trials, testTrials));
  
  return timeline;
}

function getMetacogTimeline() {
  const timeline: any[] = [];
  return timeline;
}

const idTrial: TrialType<PluginInfo> = {
  type: SurveyTextPlugin,
  questions: [
    {
      prompt: "ID:",
      name: "id",
      required: true
    }
  ],
  on_finish: (data) => {
    id = data.response.id;
  }
}

const questionnaires = [
  { value: "inthum", label: "Intellectual Humility" },
  { value: "curiosity", label: "Curiosity" },
  { value: "metacog", label: "Metacognition & Mind Wandering" }
]
const questionnaireTrial: TrialType<PluginInfo> = {
  type: HtmlButtonResponsePlugin,
  stimulus: "<p>Cuestionario</p>",
  choices: questionnaires.map(q => q.label),
  on_finish: (data) => {
    // dynamically create the rest of the timeline
    questionnaire = questionnaires[data.response].value;
    switch (questionnaire) {
      case "inthum":
        timeline.push(...getIntHumTimeline());
        break;
      case "curiosity":
        timeline.push(...getCuriosityTimeline());
        break;
      case "metacog":
        timeline.push(...getMetacogTimeline());
        break;
    }
    timeline.push(endTrial);
  }
}

const audioTestLoop = {
  timeline: [
    {
      type: AudioButtonResponsePlugin,
      stimulus: "audio/audioTest.m4a",
      choices: [ "SI", "NO" ],
      response_allowed_while_playing: false,
      on_load: () => {
        prependPreamble("<p>¡Hola! ¿Me escuchas bien?</p>")
      }      
    },
    {
      timeline: [{
        type: HtmlButtonResponsePlugin,
        stimulus: "<p>Pedile ayuda a la persona a cargo</p>",
        choices: [ "CONTINUAR" ],
        enable_button_after: 3000,
      }],
      conditional_function: () => {
        return jsPsych.data.getLastTrialData().values()[0].response == 1;
      }      
    }
  ],
  loop_function: (data: any) => {
    return data.values()[0].response == 1
  }
}

const preloadTrial = {
  type: PreloadPlugin,
  auto_preload: true,
  images: [] as string[],
  audio: [] as string[],
  video: [] as string[]
}

const endTrial = {
  type: HtmlButtonResponsePlugin,
  stimulus: "<p>¡Gracias por participar!</p>",
  choices: [],
  on_load() {
    jsPsych.data.get().localSave(
      "csv",
      `${id}_${questionnaire}_${Date.now()}.csv`);
  },
};

const timeline = [
  idTrial,
  questionnaireTrial,
  preloadTrial,
  audioTestLoop,
  // rest of timeline pushed dynamically by questionnaireTrial
];

jsPsych.run(timeline);