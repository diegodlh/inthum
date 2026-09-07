import { initJsPsych, type PluginInfo, type TrialType } from "jspsych";
import SurveyTextPlugin from "@jspsych/plugin-survey-text";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import AudioButtonResponsePlugin from "@jspsych/plugin-audio-button-response";
import VideoButtonResponsePlugin from "@jspsych/plugin-video-button-response";
import SurveyHtmlFormPlugin from "@jspsych/plugin-survey-html-form";
import PreloadPlugin from "@jspsych/plugin-preload";

import "jspsych/css/jspsych.css";
import "./style.css";

type AudioPlayer = Awaited<ReturnType<typeof jsPsych.pluginAPI.getAudioPlayer>>;

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
          type: AudioButtonResponsePlugin,
          stimulus: "audio/understood.m4a",
          choices: [ "SI", "NO" ],
          response_allowed_while_playing: test ? true : false,
          on_load: () => {
            prependPreamble("¿Se entiende esto?");
          },
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
            type: AudioButtonResponsePlugin,
            stimulus: "audio/proceed.m4a",
            choices: [ "CONTINUAR" ],
            response_allowed_while_playing: test ? true : false,
            on_load: () => {
              prependPreamble(`<p>
No te preocupes, sigamos. Después de que lea la primera pregunta, avisale a la persona a cargo si todavía no se entiende.
              </p>`);
            },
          }],
          conditional_function: () => !this.understood
        }
      ]
    }
  }
}

let id = "";
let questionnaire = "";

// tracks whether session is test (i.e., mock) session
let test = false;

const jsPsych = initJsPsych();

function getBlockTimeline(
  introTrial: any,
  startTrial: any,
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

  // add start trial
  timeline.push(startTrial);

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
    let audio: AudioPlayer;
    let audioEndedListener: EventListener;

    // reminder audio
    const hintAudioPath = "audio/hint.m4a";
    preloadTrial.audio.push(hintAudioPath);
    let hintAudio: AudioPlayer;
    let hintAudioStarted = false;
    let hintTimeoutId: ReturnType<typeof setTimeout> | undefined;

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

      radioInputs.forEach(input => input.disabled = !test ? true : false);
      if (submitButton) submitButton.disabled = !test ? true : false;

      audio = await jsPsych.pluginAPI.getAudioPlayer(audioPath);
      audio.play();

      hintAudio = await jsPsych.pluginAPI.getAudioPlayer(hintAudioPath);
      audioEndedListener = () => {
        radioInputs.forEach(input => input.disabled = false);
        if (submitButton) submitButton.disabled = false;

        hintTimeoutId = setTimeout(async () => {
          hintAudio.play();
          hintAudioStarted = true;
        }, 10000);
      };
      audio.addEventListener("ended", audioEndedListener);
    };
    trial.on_finish = () => {
      // remove "ended" event listener from audio object
      audio.removeEventListener("ended", audioEndedListener);

      // in cases where trial can finish before audio has finished playing
      // (e.g., while testing), stop audio before proceeding to the next trial.
      audio.stop();

      // clear hint timeout and stop hint audio if started
      clearTimeout(hintTimeoutId);
      if (hintAudioStarted) hintAudio.stop();
    }
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
    type: VideoButtonResponsePlugin,
    stimulus: [
      `video/inthum/intro.mp4`
    ],
    width: 720,
    trial_ends_after_video: true,
    choices: test ? [ "CONTINUAR" ] : [],
    response_allowed_while_playing: test ? true : false
  }).node);

  const startTrial: TrialType<PluginInfo> = {
    type: AudioButtonResponsePlugin,
    stimulus: "audio/inthum/start.m4a",
    choices: [ "CONTINUAR" ],
    response_allowed_while_playing: test ? true : false,
    on_load: () => {
      prependPreamble(`<p>
¡Empecemos! Para las preguntas que te voy a hacer ahora, no hay respuestas correctas o incorrectas, solamente nos interesa saber qué pensas vos.
      </p>`);
    }
  };

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
      trial_ends_after_video: true,
      choices: test ? [ "CONTINUAR" ] : [],
      response_allowed_while_playing: test ? true : false
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

    timeline.push(...getBlockTimeline(introTrial, startTrial, trials));
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
//   timeline.push(new Introduction({
//     type: AudioButtonResponsePlugin,
//     stimulus: `audio/curiosity/intro.m4a`,
//     choices: [ "CONTINUAR "],
//     response_allowed_while_playing: test ? true : false,
//     on_load: () => {
//       prependPreamble(`<p>
// Durante este cuestionario, vas a escuchar algunas frases sobre vos, y te voy a pedir que elijas cuánto se parece cada una a vos.
//       </p>`);
//     }
//   }).node);

  // add block
  const block_name = "similarity";
  const introTrial = {
    type: VideoButtonResponsePlugin,
    stimulus: [
      `video/curiosity/${block_name}_intro.mp4`
    ],
    width: 720,
    trial_ends_after_video: true,
    choices: test ? [ "CONTINUAR" ] : [],
    response_allowed_while_playing: test ? true : false
  };

  const startTrial = {
    type: AudioButtonResponsePlugin,
    stimulus: "audio/curiosity/start.m4a",
    choices: [ "CONTINUAR" ],
    response_allowed_while_playing: test ? true : false,
    on_load: () => {
      prependPreamble("<p>Ahora sí, ¡empecemos!</p>")
    }
  };

  // add test trials
  const testTrials = [];
  testTrials.push(getLikertTrial(
    'Empecemos con una de prueba. Escucha a la siguiente oración: "Me encanta el chocolate".',
    block_name,
    `audio/curiosity/${block_name}_test.m4a`
  ));

  // add real trials
  const trials = [];
  const questions = QUESTIONS[block_name];
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const audioPath = `audio/curiosity/${block_name}_${i}.m4a`;
    const trial = getLikertTrial(question, block_name, audioPath);
    trials.push(trial);
  }

  timeline.push(...getBlockTimeline(introTrial, startTrial, trials, testTrials));
  
  return timeline;
}

type MetacogAudioProps = {
  path: string;
  player?: AudioPlayer;
  endedListener?: EventListener;
}

function getMetacogAudioEndedListener(
  nextButton: HTMLButtonElement,
  trial: TrialType<PluginInfo>,
  nextPlayer?: AudioPlayer,
): EventListener {
  return () => {
    nextButton.classList.remove("invisible");
    if (nextPlayer && !trial.finished) {
      // using custom finished property because
      // audio plugin may stop player before we remove ended listener
      nextPlayer.play()
    };
  }
}

function getMetacogTrial(
  qid: string,
  question: string,
  choiceA: string,
  choiceB: string
) {
  const image = `images/metacog/${qid}.jpg`;
  preloadTrial.images.push(image);

  const audio: Record<string, MetacogAudioProps> = {
    question: {
      path: `audio/metacog/${qid}.m4a`
    },
    choiceA: {
      path: `audio/metacog/${qid}a.m4a`
    },
    choiceB: {
      path: `audio/metacog/${qid}b.m4a`
    },
    unknown: {
      path: "audio/metacog/unknown.m4a"
    }
  };
  for (const props of Object.values(audio)) {
    preloadTrial.audio.push(props.path);
  }

  const trial: TrialType<PluginInfo> = {
    type: AudioButtonResponsePlugin,
    stimulus: audio.question.path,
    choices: [
      choiceA,
      "No sé",
      choiceB
    ],
    on_load: async () => {
      prependPreamble(`
        <img src="${image}" width="720px" />
        <p>${question}</p>
      `);

      const buttons = document.querySelectorAll<HTMLButtonElement>(
        "#jspsych-audio-button-response-btngroup button"
      );
      if (!test) {
        buttons.forEach(button => {
          button.classList.add("invisible");
          button.disabled = true;
        })
      }

      for (const props of Object.values(audio)) {
        props.player = await jsPsych.pluginAPI.getAudioPlayer(props.path);
      }

      audio.question.endedListener = getMetacogAudioEndedListener(
        buttons[0], trial, audio.choiceA.player
      );
      audio.choiceA.endedListener = getMetacogAudioEndedListener(
        buttons[2], trial, audio.choiceB.player
      );
      audio.choiceB.endedListener = getMetacogAudioEndedListener(
        buttons[1], trial, audio.unknown.player
      );
      audio.unknown.endedListener = () => {
        buttons.forEach(button => {
          button.disabled = false;
        });
      }
      for (const props of Object.values(audio)) {
        if (props.player && props.endedListener) {
          props.player.addEventListener("ended", props.endedListener);
        }
      }
    },
    finished: false,  // custom finished property
    on_finish: () => {
      trial.finished = true;
      for (const props of Object.values(audio)) {
        if (props.player) {
          if (props.endedListener) {
            props.player.removeEventListener("ended", props.endedListener);
          }

          try {
            props.player.stop();
          } catch {
            // stopping will fail if never played
          }
        }
      }
    }
  }
  return trial;
}

function getMetacogTimeline() {
  const timeline: any[] = [];

  const introTrial = {
    type: AudioButtonResponsePlugin,
    stimulus: "audio/metacog/intro.m4a",
    trial_ends_after_audio: true,
    choices: test ? [ "CONTINUAR" ] : [],
    response_allowed_while_playing: test ? true : false,
    on_load: () => {
      prependPreamble(`
        <p>Ahora vas a responder algunas preguntas sobre estudiantes de otra escuela.  Siempre va a haber 3 respuestas para elegir. El botón del medio dice “No sé”. Presioná este botón si no sabés cuál de las otras dos respuestas es correcta.</p>
      `);
    }
  };

  const startTrial = {
    timeline: [
      {
        type: AudioButtonResponsePlugin,
        stimulus: "audio/metacog/start.m4a",
        choices: [ "SI", "NO" ],
        response_allowed_while_playing: test ? true : false,
        on_load: () => {
          prependPreamble("<p>¿Estás listo?</p>")
        }
      }
    ],
    loop_function: (data: any) => {
      return data.values()[0].response == 1
    }
  };

  const trials = [
    getMetacogTrial(
      "q1",
      "Fede y Nico están en la clase de la seño Ceci en una actividad de lectura. Mientras que Fede está escuchando el cuento que lee la seño Ceci, otros pensamientos aparecen en su cabeza. Pero cuando Nico escucha el cuento, no le aparecen otros pensamientos en su cabeza. ¿Quién creés que se va a acordar más sobre la historia que leyó la seño Ceci?",
      "Nico, quien no tuvo otros pensamientos en su cabeza",
      "Fede, quien tuvo otros pensamientos en su cabeza"
    ),
    getMetacogTrial(
      "q2",
      "Cande y Martu están en la clase del seño Juan en una actividad de matemáticas. Mientras Cande escucha al seño Juan explicar un problema de matemáticas, otros pensamientos aparecen en su cabeza. Pero cuando Martu escucha al seño Juan, no tiene otros pensamientos en su cabeza. ¿Quién crees que tiene más probabilidades de resolver el problema de matemáticas que el seño Juan escribió en el pizarrón?",
      "Martu, quien no tuvo otros pensamientos en su cabeza",
      "Cande, quien tuvo otros pensamientos en su cabeza"
    )
  ]

  timeline.push(...getBlockTimeline(introTrial, startTrial, trials));

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
    test = id === "test";
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
      response_allowed_while_playing: () => { return test ? true : false },
      on_load: () => {
        prependPreamble("<p>¡Hola! ¿Me escuchas bien?</p>")
      }
    },
    {
      timeline: [{
        type: AudioButtonResponsePlugin,
        stimulus: "audio/help.m4a",
        choices: [ "CONTINUAR" ],
        response_allowed_while_playing: test ? true : false,
        enable_button_after: 3000,
        on_load: () => {
          prependPreamble("<p>Pedile ayuda a la persona a cargo</p>");
        }
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
  type: AudioButtonResponsePlugin,
  stimulus: "audio/thanks.m4a",
  choices: [],
  on_load() {
    prependPreamble("<p>¡Gracias por participar!</p>");
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