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
  const form = document.querySelector("#loan-form");
  const errorBox = document.querySelector("#application-error");
  const successBox = document.querySelector("#application-success");
  const readinessCard = document.querySelector("#readiness-card");

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

  const submitLoanApplicationDemoMock = (payload) =>
    Promise.resolve({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          confirmationId: "PL-" + payload.applicationSessionId.slice(-8).toUpperCase(),
        }),
    });

  const submitLoanApplication = async (payload) => {
    try {
      const response = await fetch("/api/loan-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (![404, 405, 501].includes(response.status)) {
        return response;
      }
    } catch (error) {
      console.warn("LoanApplicationApiWarning: falling back to demo submission flow", {
        message: error.message,
      });
    }

    return submitLoanApplicationDemoMock(payload);
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

      window.setTimeout(() => {
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

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled loan submission promise rejection captured", event.reason);
  });

  updateSummary();
  logJourneyEvent("application_loaded", {
    product: "personal_loan",
    prequalified: true,
  });
})();
