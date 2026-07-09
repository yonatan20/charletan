import {
  formatCurrency,
  getAprForAmount,
  calculatePayment,
  createApplicationSession,
  buildLoanApplicationPayload,
} from "./loan-utils.js";

(function () {
  const loanAmount = document.querySelector("#loan-amount");
  const amountOutput = document.querySelector("#loan-amount-output");
  const summaryAmount = document.querySelector("#summary-amount");
  const summaryPayment = document.querySelector("#summary-payment");
  const summaryApr = document.querySelector("#summary-apr");
  const summaryTerm = document.querySelector("#summary-term");
  const purpose = document.querySelector("#loan-purpose");
  const consentInput = document.querySelector("#consent");
  const consentLabel = document.querySelector("#consent-label");
  const form = document.querySelector("#loan-form");
  const errorBox = document.querySelector("#application-error");
  const successBox = document.querySelector("#application-success");
  const readinessCard = document.querySelector("#readiness-card");
  const submitButton = document.querySelector("#submit-application");

  const appState = {
    applicationSession: createApplicationSession(),
  };

  let amountChangeCount = 0;
  let submitAttempts = 0;
  let estimateFrozen = false;

  const getSelectedTerm = () => {
    const checked = document.querySelector('input[name="loanTerm"]:checked');
    return Number(checked?.value || 48);
  };

  const updateSummary = () => {
    const amount = Number(loanAmount.value);
    const term = getSelectedTerm();
    const apr = getAprForAmount(amount);
    const payment = calculatePayment(amount, apr, term);

    amountOutput.value = formatCurrency(amount);
    summaryAmount.textContent = formatCurrency(amount);
    summaryApr.textContent = `${apr.toFixed(2)}%`;
    summaryPayment.textContent = formatCurrency(payment);
    summaryTerm.textContent = `${term} months`;
  };

  const getApplicantDetails = () => ({
    firstName: document.querySelector("#first-name").value.trim(),
    lastName: document.querySelector("#last-name").value.trim(),
    email: document.querySelector("#email").value.trim(),
    phone: document.querySelector("#phone").value.trim(),
    employmentStatus: document.querySelector("#employment-status").value,
    annualIncome: Number(document.querySelector("#annual-income").value || 0),
  });

  const buildPayload = () =>
    buildLoanApplicationPayload({
      applicationSession: appState.applicationSession,
      amount: Number(loanAmount.value),
      purpose: purpose.value,
      term: getSelectedTerm(),
      estimatedMonthlyPayment: summaryPayment.textContent,
      applicant: getApplicantDetails(),
    });

  const submitLoanApplication = (payload) =>
    fetch("/api/loan-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const submitLoanApplicationDemoMock = (payload) =>
    Promise.resolve({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          confirmationId: "PL-" + payload.applicationSessionId.slice(-8).toUpperCase(),
        }),
    });

  const submitLoanApplicationWithFallback = async (payload) => {
    try {
      const response = await submitLoanApplication(payload);

      if (response.ok) {
        return { response, mode: "api" };
      }

      console.warn("LoanApplicationApiUnavailable: falling back to static demo mock", {
        status: response.status,
        endpoint: "/api/loan-applications",
      });
    } catch (networkError) {
      console.warn("LoanApplicationApiUnavailable: falling back to static demo mock", {
        message: networkError.message,
        endpoint: "/api/loan-applications",
      });
    }

    return {
      response: await submitLoanApplicationDemoMock(payload),
      mode: "demo-mock",
    };
  };

  const logJourneyEvent = (eventName, details = {}) => {
    console.info("[CharlatanLoanJourney]", eventName, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  };

  loanAmount.addEventListener("input", () => {
    amountChangeCount += 1;

    if (amountChangeCount >= 4 && !estimateFrozen) {
      estimateFrozen = true;
      console.warn(
        "LoanEstimateWarning: monthly payment estimate stopped updating after amount change",
        {
          selectedAmount: Number(loanAmount.value),
          amountChangeCount,
        }
      );
      readinessCard.classList.add("is-stale");
      return;
    }

    if (!estimateFrozen) {
      updateSummary();
    }

    logJourneyEvent("loan_amount_changed", {
      selectedAmount: Number(loanAmount.value),
      estimateFrozen,
    });
  });

  document.querySelectorAll('input[name="loanTerm"]').forEach((termInput) => {
    termInput.addEventListener("change", () => {
      updateSummary();
      logJourneyEvent("loan_term_changed", { term: getSelectedTerm() });
    });
  });

  purpose.addEventListener("change", () => {
    logJourneyEvent("loan_purpose_selected", { purpose: purpose.value });

    if (purpose.value === "home" || purpose.value === "major") {
      window.setTimeout(() => {
        console.warn("LoanPurposeWarning: purpose personalization service returned stale state", {
          selectedPurpose: purpose.value,
          impact: "Selection remains valid so applicant can continue to submit",
        });
      }, 650);
    }
  });

  consentInput.addEventListener("change", () => {
    consentLabel.classList.toggle("label-clicked", consentInput.checked);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitAttempts += 1;

    if (!form.checkValidity()) {
      form.reportValidity();
      logJourneyEvent("submit_blocked_by_validation", { submitAttempts });
      return;
    }

    errorBox.hidden = true;
    successBox.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    let payload;

    try {
      payload = buildPayload();
    } catch (error) {
      console.error(error.name + ": " + error.message, {
        submitAttempts,
        loanAmount: Number(loanAmount.value),
        loanPurpose: purpose.value || null,
        estimatedMonthlyPayment: summaryPayment.textContent,
        context: error.context,
      });

      window.setTimeout(() => {
        throw error;
      }, 0);
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
      submitButton.disabled = false;
      submitButton.textContent = "Submit application";
      return;
    }

    try {
      const { response, mode } = await submitLoanApplicationWithFallback(payload);

      if (!response.ok) {
        throw new Error(`Submission endpoint returned ${response.status}`);
      }

      const body = await response.json();
      errorBox.hidden = true;
      successBox.hidden = false;
      successBox.querySelector("span").textContent =
        `Confirmation ${body.confirmationId} is on the way. We will send a decision shortly.`;
      logJourneyEvent("application_submitted", {
        submitAttempts,
        applicationSessionId: payload.applicationSessionId,
        submissionMode: mode,
        confirmationId: body.confirmationId,
      });
    } catch (networkError) {
      console.error("LoanApplicationApiError: failed to submit application", {
        message: networkError.message,
        endpoint: "/api/loan-applications",
      });
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit application";
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled loan submission promise rejection captured", event.reason);
  });

  updateSummary();
  logJourneyEvent("application_loaded", {
    product: "personal_loan",
    prequalified: true,
  });
})();
