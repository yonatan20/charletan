export class LoanSubmissionError extends Error {
  constructor(message, context) {
    super(message);
    this.name = "LoanSubmissionError";
    this.context = context;
  }
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export const getAprForAmount = (amount) =>
  amount > 50000 ? 9.34 : amount > 25000 ? 8.74 : 7.89;

export const calculatePayment = (principal, apr, months) => {
  const monthlyRate = apr / 100 / 12;
  return principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
};

export const createApplicationSession = () => ({
  id: "loan-session-" + Date.now().toString(36),
  createdAt: new Date().toISOString(),
});

export const buildLoanApplicationPayload = ({
  applicationSession,
  amount,
  purpose,
  term,
  estimatedMonthlyPayment,
  applicant,
}) => {
  const applicationSessionId = applicationSession?.id;

  if (!applicationSessionId) {
    throw new LoanSubmissionError("applicationSessionId is undefined", {
      reason: "appState.applicationSession was not initialized",
      expectedStateShape: "{ applicationSession: { id: string } }",
    });
  }

  return {
    applicationSessionId,
    amount,
    purpose,
    term,
    estimatedMonthlyPayment,
    applicant,
  };
};
