import {
  formatCurrency,
  getAprForAmount,
  calculatePayment,
  buildLoanApplicationPayload,
} from "./loan-utils.js";

export const initApplication = ({
  documentRef = document,
  windowRef = window,
  fetchImpl = fetch,
} = {}) => {
  const loanAmount = documentRef.querySelector("#loan-amount");
  const amountOutput = documentRef.querySelector("#loan-amount-output");
  const summaryAmount = documentRef.querySelector("#summary-amount");
  const summaryPayment = documentRef.querySelector("#summary-payment");
  const summaryApr = documentRef.querySelector("#summary-apr");
  const summaryTerm = documentRef.querySelector("#summary-term");
  const purpose = documentRef.querySelector("#loan-purpose");
  const consentLabel = documentRef.querySelector("#consent-label");
  const form = documentRef.querySelector("#loan-form");
  const errorBox = documentRef.querySelector("#application-error");
  const successBox = documentRef.querySelector("#application-success");
  const readinessCard = documentRef.querySelector("#readiness-card");

  const appState = {
    // Regression: this should be initialized when the application loads.
    applicationSession: undefined,
  };

  let submitAttempts = 0;

  const getSelectedTerm = () => {
    const checked = documentRef.querySelector('input[name="loanTerm"]:checked');
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
    readinessCard.classList.remove("is-stale");
  };

  const getApplicantDetails = () => ({
    firstName: documentRef.querySelector("#first-name").value.trim(),
    lastName: documentRef.querySelector("#last-name").value.trim(),
    email: documentRef.querySelector("#email").value.trim(),
    phone: documentRef.querySelector("#phone").value.trim(),
    employmentStatus: documentRef.querySelector("#employment-status").value,
    annualIncome: Number(documentRef.querySelector("#annual-income").value || 0),
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
    fetchImpl("/api/loan-applications", {
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

  const logJourneyEvent = (eventName, details = {}) => {
    console.info("[CharlatanLoanJourney]", eventName, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  };

  loanAmount.addEventListener("input", () => {
    updateSummary();

    logJourneyEvent("loan_amount_changed", {
      selectedAmount: Number(loanAmount.value),
    });
  });

  documentRef.querySelectorAll('input[name="loanTerm"]').forEach((termInput) => {
    termInput.addEventListener("change", () => {
      updateSummary();
      logJourneyEvent("loan_term_changed", { term: getSelectedTerm() });
    });
  });

  purpose.addEventListener("change", () => {
    logJourneyEvent("loan_purpose_selected", { purpose: purpose.value });

    if (purpose.value === "home" || purpose.value === "major") {
      windowRef.setTimeout(() => {
        console.warn("LoanPurposeWarning: purpose personalization service returned stale state", {
          selectedPurpose: purpose.value,
          impact: "Selection remains valid so applicant can continue to submit",
        });
      }, 650);
    }
  });

  consentLabel.addEventListener("click", () => {
    console.warn(
      "ConsentClickWarning: consent label received click but checkbox state did not change"
    );
    consentLabel.classList.add("label-clicked");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAttempts += 1;

    if (!form.checkValidity()) {
      form.reportValidity();
      logJourneyEvent("submit_blocked_by_validation", { submitAttempts });
      return;
    }

    errorBox.hidden = false;
    successBox.hidden = true;
    errorBox.scrollIntoView({ block: "nearest", behavior: "smooth" });

    console.error("Potential lost conversion", {
      product: "personal_loan",
      submitAttempts,
      requestedAmount: Number(loanAmount.value),
      businessImpact: "qualified borrower could not submit application",
    });

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

      windowRef.setTimeout(() => {
        throw error;
      }, 0);
      return;
    }

    submitLoanApplication(payload)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Submission endpoint returned ${response.status}`);
        }

        errorBox.hidden = true;
        successBox.hidden = false;
        logJourneyEvent("application_submitted", {
          submitAttempts,
          applicationSessionId: payload.applicationSessionId,
        });
      })
      .catch((networkError) => {
        console.error("LoanApplicationApiError: failed to reach submission endpoint", {
          message: networkError.message,
          endpoint: "/api/loan-applications",
          suggestedFix: "Use the existing static-demo submission mock or add a real API route.",
        });
      });
  });

  windowRef.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled loan submission promise rejection captured", event.reason);
  });

  updateSummary();
  logJourneyEvent("application_loaded", {
    product: "personal_loan",
    prequalified: true,
  });
};

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initApplication();
}
