// ──────────────────────────────────────────────────────────────
// consent.js — required USC IRB consent gate
//
// Approved source: "Approved Informed Consent 4.18.23.pdf"
// Study ID: UP-23-00359; version date: 04/18/2023.
//
// The approved wording below is reproduced verbatim. Presentation-only
// markup and styling adapt the three-page document for a web browser.
// ──────────────────────────────────────────────────────────────

/**
 * Build the consent trial object.
 *
 * @param {Object} callbacks
 *   .onDecline() — called when the participant clicks "DECLINE"
 *   .onBot()     — called when the hidden honeypot is triggered
 * @returns {Object} jsPsych html-button-response trial
 */
window.buildConsentTrial = function(callbacks) {
  callbacks = callbacks || {};

  var institutionHeader =
    '<header class="consent-institution">' +
      '<div class="consent-university">University of Southern California</div>' +
      '<div class="consent-department">Department of Psychology</div>' +
      '<div class="consent-address">SGM 501, 3620 McClintock Ave, Los Angeles, CA 90089</div>' +
    '</header>';

  function approvalStamp() {
    return '<aside class="consent-approval" aria-label="IRB approval information">' +
      '<span>Study ID: UP-23-00359</span>' +
      '<span>Valid From: 4/18/2023</span>' +
    '</aside>';
  }

  function pageFooter(pageNumber) {
    return '<footer class="consent-footer">' +
      '<div>' +
        '<div>Version Date: <span class="consent-version">[04/18/2023]</span></div>' +
        '<div class="consent-template-version">USC IRB ICF Template Version Date: 10/10/2022</div>' +
      '</div>' +
      '<div>Page ' + pageNumber + ' of 3</div>' +
    '</footer>';
  }

  var stimulus = `
    <style>
      .jspsych-display-element {
        background:
          radial-gradient(circle at 12% 5%, rgba(153, 27, 30, .08), transparent 28rem),
          linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      }

      #jspsych-html-button-response-stimulus {
        width: 100%;
      }

      .consent-shell {
        width: min(100%, 980px);
        margin: 0 auto;
        color: #1f2937;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        text-align: left;
      }

      .consent-page {
        position: relative;
        box-sizing: border-box;
        margin: 24px auto;
        padding: 52px 66px 34px;
        overflow: hidden;
        border: 1px solid #d8dee8;
        border-top: 5px solid #990000;
        border-radius: 18px;
        background: rgba(255, 255, 255, .98);
        box-shadow: 0 18px 48px rgba(15, 23, 42, .10);
      }

      .consent-institution {
        margin: 0 auto 34px;
        text-align: center;
        color: #111827;
      }

      .consent-university,
      .consent-department {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 24px;
        font-weight: 700;
        line-height: 1.15;
      }

      .consent-department {
        font-size: 21px;
      }

      .consent-address {
        margin-top: 5px;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 15px;
        line-height: 1.4;
      }

      .consent-document-title {
        margin: 0 0 22px;
        color: #111827;
        font-size: 25px;
        font-weight: 850;
        letter-spacing: .025em;
        text-align: center;
      }

      .consent-study-meta {
        display: grid;
        gap: 10px;
        margin-bottom: 30px;
        padding: 20px 22px;
        border: 1px solid #ead7d8;
        border-radius: 14px;
        background: #fffafa;
        font-size: 16px;
        line-height: 1.45;
      }

      .consent-study-meta strong {
        color: #590000;
      }

      .consent-section {
        margin: 28px 0;
      }

      .consent-section h2,
      .consent-section h3 {
        margin: 0 0 8px;
        color: #660000;
        font-size: 19px;
        font-weight: 850;
        letter-spacing: .025em;
        line-height: 1.25;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 4px;
      }

      .consent-section h2 {
        text-align: center;
        text-decoration: none;
      }

      .consent-section h4 {
        margin: 20px 0 6px;
        color: #1f2937;
        font-size: 17px;
        font-weight: 800;
      }

      .consent-section p {
        margin: 0 0 14px;
        color: #374151;
        font-size: 16px;
        line-height: 1.68;
      }

      .consent-approval {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 18px;
        justify-content: flex-end;
        margin: 34px 0 14px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
      }

      .consent-footer {
        display: flex;
        gap: 20px;
        align-items: flex-end;
        justify-content: space-between;
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
        color: #475569;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 12px;
        line-height: 1.45;
      }

      .consent-version {
        color: #c1121f;
      }

      .consent-template-version {
        font-size: 10px;
        font-style: italic;
      }

      .consent-statement {
        margin-top: 30px;
        padding: 24px 26px;
        border: 1px solid #d6c69a;
        border-radius: 14px;
        background: linear-gradient(135deg, #fffdf6, #fffaf0);
      }

      .consent-statement h2 {
        color: #4b3200;
      }

      .consent-statement p {
        margin-bottom: 0;
        color: #292524;
        font-size: 17px;
      }

      #jspsych-html-button-response-btngroup {
        display: flex;
        width: min(100%, 720px);
        box-sizing: border-box;
        gap: 14px;
        justify-content: center;
        margin: 26px auto 42px;
        padding: 22px;
        border: 1px solid #d8dee8;
        border-radius: 16px;
        background: rgba(255, 255, 255, .96);
        box-shadow: 0 12px 32px rgba(15, 23, 42, .10);
      }

      .consent-action {
        min-width: 180px;
        padding: 13px 24px;
        border-radius: 11px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 15px;
        font-weight: 850;
        letter-spacing: .045em;
        cursor: pointer;
        transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
      }

      .consent-action:hover {
        transform: translateY(-1px);
      }

      .consent-accept {
        border: 1px solid #7a0000;
        background: #990000;
        color: #fff;
        box-shadow: 0 8px 22px rgba(153, 0, 0, .22);
      }

      .consent-accept:hover {
        background: #7a0000;
        box-shadow: 0 10px 26px rgba(153, 0, 0, .28);
      }

      .consent-decline {
        border: 1px solid #cbd5e1;
        background: #fff;
        color: #475569;
      }

      .consent-decline:hover {
        border-color: #94a3b8;
        background: #f8fafc;
        color: #1f2937;
      }

      @media (max-width: 720px) {
        .consent-page {
          padding: 34px 24px 26px;
          border-radius: 13px;
        }

        .consent-university {
          font-size: 21px;
        }

        .consent-department {
          font-size: 19px;
        }

        .consent-section p {
          font-size: 15px;
          line-height: 1.62;
        }

        #jspsych-html-button-response-btngroup {
          flex-direction: column;
        }

        .consent-action {
          width: 100%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .consent-action {
          transition: none;
        }
      }
    </style>

    <main class="consent-shell">
      <article class="consent-page">
        ${institutionHeader}
        <h1 class="consent-document-title">INFORMED CONSENT FOR RESEARCH</h1>

        <div class="consent-study-meta">
          <div><strong>Study Title:</strong> Learning and decision making under uncertainty</div>
          <div><strong>Principal Investigator:</strong> Payam Piray, PhD</div>
          <div><strong>Department:</strong> Psychology, University of Southern California</div>
        </div>

        <section class="consent-section">
          <h2>INTRODUCTION</h2>
          <p>We invite you to take part in a research study. Please take as much time as you need to read the consent form. You may want to discuss it with your family, friends, or your personal doctor. If you find any of the language difficult to understand, please ask questions.</p>
        </section>

        <section class="consent-section">
          <h3>PURPOSE</h3>
          <p>With this research we hope to study the following objectives related to human learning and decision-making: 1) Understanding how humans learn from feedback; and 2) Understanding how humans draw on this knowledge to make decisions. You are invited as a possible participant because you are at least 18 years old, and you speak English fluently. This research is funded by the National Institutes of Health.</p>
        </section>

        <section class="consent-section">
          <h3>PROCEDURES</h3>
          <p>If you decide to take part, this is what will happen: you will be asked to complete a series of online surveys and behavioral tasks. The online surveys will ask questions about you, and may include questions about your mental health and suicide. During the tasks, you will repeatedly be presented with images on the computer screen and asked to make decisions or responses using button-presses or mouse-clicks. Before and after the behavioral tasks, you may be asked to answer some questions about the tasks. You might be asked to participate in future phases of the study, which will take place using the same online survey platform. If you are asked to participate in future phases, you will be given the opportunity to provide informed consent for each phase separately.</p>
        </section>

        <section class="consent-section">
          <h3>RISKS AND DISCOMFORTS</h3>
          <p>Possible risks and discomforts you could experience during this study include:</p>

          <h4>Surveys/Questionnaires</h4>
          <p>This study includes questions related to mental health: about your emotions and reactions to being placed in certain situations, and the levels at which you may identify with certain thoughts or feelings. Some participants may find these questions troubling. You can choose to skip or stop answering any questions you don’t want to. The experimenters are not clinicians and not in a position to diagnose any disorders or offer medical advice. If the questions trouble you, we urge you to seek further advice or information from healthcare professionals. At the completion of the experiment, we will provide you with resources for learning more about mental health conditions and for seeking support if you so wish. Some of the questions may ask you about suicide. If your responses indicate some levels of suicidal thoughts, you will be provided with a list of resources to contact for further support. The researchers will not be monitoring your responses in real time, and will not be able to know if you have sought support from the resources provided.</p>
        </section>

        ${approvalStamp()}
        ${pageFooter(1)}
      </article>

      <article class="consent-page">
        ${institutionHeader}

        <section class="consent-section">
          <h4>Breach of Confidentiality</h4>
          <p>There is a small risk that people who are not connected with this study will learn your identity or your personal information. To mitigate this risk, your data will be collected anonymously meaning the researchers will not have access to your personal identifying information. We will not ask you for any identifiable information during or after this experiment. The survey platforms will have access to your identifiers and contact information, but will not have access to your responses.</p>
        </section>

        <section class="consent-section">
          <h3>BENEFITS</h3>
          <p>There are no direct benefits to you from taking part in this study. However, your participation in this study may help us learn how humans make decisions.</p>
        </section>

        <section class="consent-section">
          <h3>PRIVACY/CONFIDENTIALITY</h3>
          <p>Your data will be collected anonymously. Researchers have no access to your personal identifying information, which you have provided to the online platform.</p>
          <p>The University of Southern California’s Institutional Review Board (IRB) and Human Subject’s Protections Program (HSPP) may review your records. Organizations that may also inspect and copy your information include the funding agency National Institutes of Health.</p>
          <p>Your anonymous data might be used or distributed for future research studies without your additional informed consent. Your anonymous data will be retained by the investigator for future use indefinitely.</p>
          <p>This study is conducted on [Amazon Mechanical Turk or Prolific], and it follows their Privacy Policy. We highly recommend that you familiarize yourself with the privacy policies of the platform. Please be aware that while researchers do not have access to your identifiable information, there is a potential risk of breach of confidentiality associated with any online platform.</p>
        </section>

        <section class="consent-section">
          <h3>ALTERNATIVES</h3>
          <p>An alternative would be to not participate in this study.</p>
        </section>

        <section class="consent-section">
          <h3>PAYMENTS / COMPENSATION</h3>
          <p>You will receive compensation at a rate of approximately $8 per hour, based on the estimated length of the study, plus an additional bonus based on your performance in the experiment. Your compensation may vary depending on your agreement with the survey platform. Payments for research participation are considered taxable income and participants may be required to pay taxes on this income.</p>
        </section>

        <section class="consent-section">
          <h3>VOLUNTARY PARTICIPATION</h3>
          <p>It is your choice whether to participate. If you choose to participate, you may change your mind and leave the study at any time. If you decide not to participate, or choose to end your participation in this study, you will not be penalized or lose any benefits that you are otherwise entitled to. If you stop being in the research, already collected data may not be removed from the study database.</p>
        </section>

        ${approvalStamp()}
        ${pageFooter(2)}
      </article>

      <article class="consent-page">
        ${institutionHeader}

        <section class="consent-section">
          <h3>CONTACT INFORMATION</h3>
          <p>If you have any questions about this study, please contact the principal investigator, Payam Piray, at piray@usc.edu</p>
          <p>This research has been reviewed by the USC Institutional Review Board (IRB). The IRB is a research review board that reviews and monitors research studies to protect the rights and welfare of research participants. Contact the IRB if you have questions about your rights as a research participant or you have complaints about the research. You may contact the IRB at (323) 442-0114 or by email at irb@usc.edu.</p>
        </section>

        <section class="consent-section consent-statement">
          <h2>STATEMENT OF CONSENT</h2>
          <p>I have read the information provided above. I have been given a chance to ask questions. All my questions have been answered. By clicking the “ACCEPT” button below, I hereby give my consent to be the subject of this research.</p>
        </section>

        ${approvalStamp()}
        ${pageFooter(3)}
      </article>

      <div aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px;height:0;width:0;overflow:hidden;">
        <input type="checkbox" id="future_contact" name="future_contact" tabindex="-1" autocomplete="off">
      </div>
    </main>`;

  return {
    type: 'html-button-response',
    stimulus: stimulus,
    choices: ['ACCEPT', 'DECLINE'],
    button_html: [
      '<button class="consent-action consent-accept">%choice%</button>',
      '<button class="consent-action consent-decline">%choice%</button>'
    ],
    on_load: function() {
      window.scrollTo(0, 0);
      var hp = document.getElementById('future_contact');
      if (hp) {
        hp.addEventListener('change', function() {
          if (hp.checked) window._bot_detected = true;
        });
      }
    },
    on_finish: function(data) {
      var hp = document.getElementById('future_contact');
      if (hp && hp.checked) window._bot_detected = true;

      if (window._bot_detected && callbacks.onBot) {
        callbacks.onBot();
      } else if ((data.response !== undefined ? data.response : data.button_pressed) === 1) {
        if (callbacks.onDecline) callbacks.onDecline();
      }
    },
    data: {
      trial_category: 'consent',
      consent_study_id: 'UP-23-00359',
      consent_version_date: '04/18/2023'
    }
  };
};
