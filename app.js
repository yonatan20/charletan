(function () {
  const loanAmount = document.querySelector("#loan-amount");
  const amountOutput = document.querySelector("#loan-amount-output");
  const summaryAmount = document.querySelector("#summary-amount");
  const summaryPayment = document.querySelector("#summary-payment");
  const summaryApr = document.querySelector("#summary-apr");
  const summaryTerm = document.querySelector("#summary-term");
  const purpose = document.querySelector("#loan-purpose");
  const consentLabel = document.querySelector("#consent-label");
  const term60Option = document.querySelector("#term-60-option");
  const form = document.querySelector("#loan-form");
  const errorBox = document.querySelector("#application-error");
  const successBox = document.querySelector("#application-success");
  const readinessCard = document.querySelector("#readiness-card");

  class LoanSubmissionError extends Error {
    constructor(message, context) {
      super(message);
      this.name = "LoanSubmissionError";
      this.context = context;
    }
  }

  class LoanEstimateStaleError extends Error {
    constructor(message, context) {
      super(message);
      this.name = "LoanEstimateStaleError";
      this.context = context;
    }
  }

  class LoanTermSelectionError extends Error {
    constructor(message, context) {
      super(message);
      this.name = "LoanTermSelectionError";
      this.context = context;
    }
  }

  class ConsentLabelBindingError extends Error {
    constructor(message, context) {
      super(message);
      this.name = "ConsentLabelBindingError";
      this.context = context;
    }
  }

  const reportFixableIssue = (error, severity = "error") => {
    const payload = {
      message: error.message,
      context: error.context,
      fixScope: "single interaction regression",
    };

    if (severity === "warn") {
      console.warn(`${error.name}: ${error.message}`, payload);
      return;
    }

    console.error(`${error.name}: ${error.message}`, payload);
  };

  const appState = {
    // Regression: this should be initialized when the application loads.
    applicationSession: undefined,
  };

  let amountChangeCount = 0;
  let submitAttempts = 0;
  let deadTermClicks = 0;
  let estimateFrozen = false;

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  const getSelectedTerm = () => {
    const checked = document.querySelector('input[name="loanTerm"]:checked');
    return Number(checked?.value || 48);
  };

  const calculatePayment = (principal, apr, months) => {
    const monthlyRate = apr / 100 / 12;
    return principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
  };

  const createApplicationSession = () => ({
    id: "loan-session-" + Date.now().toString(36),
    createdAt: new Date().toISOString(),
  });

  const updateSummary = () => {
    const amount = Number(loanAmount.value);
    const term = getSelectedTerm();
    const apr = amount > 50000 ? 9.34 : amount > 25000 ? 8.74 : 7.89;
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

  const buildLoanApplicationPayload = () => {
    const applicationSessionId = appState.applicationSession?.id;

    if (!applicationSessionId) {
      throw new LoanSubmissionError("applicationSessionId is undefined", {
        reason: "appState.applicationSession was not initialized",
        expectedStateShape: "{ applicationSession: { id: string } }",
      });
    }

    return {
      applicationSessionId,
      amount: Number(loanAmount.value),
      purpose: purpose.value,
      term: getSelectedTerm(),
      estimatedMonthlyPayment: summaryPayment.textContent,
      applicant: getApplicantDetails(),
    };
  };

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
      reportFixableIssue(
        new LoanEstimateStaleError("monthly payment estimate stopped updating after amount change", {
          selectedAmount: Number(loanAmount.value),
          amountChangeCount,
          suggestedFix: "Always call updateSummary() when loanAmount changes and remove the estimateFrozen guard.",
        })
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

  term60Option.addEventListener("click", (event) => {
    event.preventDefault();
    deadTermClicks += 1;

    const fallbackTerm = document.querySelector('input[name="loanTerm"][value="48"]');
    fallbackTerm.checked = true;
    term60Option.classList.add("rage-clicked");
    updateSummary();

    reportFixableIssue(
      new LoanTermSelectionError("60 month term did not select", {
        attemptedTerm: 60,
        activeTerm: getSelectedTerm(),
        deadTermClicks,
        impact: "Applicant may repeatedly click the 60 month option without changing the offer.",
        suggestedFix: "Remove event.preventDefault() and the forced fallback to 48 months from the 60 month click handler.",
      })
    );

    logJourneyEvent("loan_term_dead_click", {
      attemptedTerm: 60,
      deadTermClicks,
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

  consentLabel.addEventListener("click", () => {
    reportFixableIssue(
      new ConsentLabelBindingError("consent label received click but checkbox state did not change", {
        clickedElement: "#consent-label",
        expectedTarget: "#consent",
        impact: "Applicant clicks the consent sentence but the required checkbox remains unchecked.",
        suggestedFix: "Replace the span with a real <label for=\"consent\"> or toggle the checkbox from the click handler.",
      })
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
      payload = buildLoanApplicationPayload();
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
