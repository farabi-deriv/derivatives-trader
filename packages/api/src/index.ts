import useInfiniteQuery from './useInfiniteQuery';
import useMutation from './useMutation';
import useQueries from './useQueries';
import useQuery from './useQuery';

export { default as APIProvider } from './APIProvider';
export { default as useInvalidateQuery } from './useInvalidateQuery';
export { default as useSubscription } from './useSubscription';
export { default as useRemoteConfig } from './hooks/useRemoteConfig';
export { useRestAPI } from './useRestAPI';
export * from './hooks';

export { useInfiniteQuery, useMutation, useQueries, useQuery };

// Export types from types.ts
export type {
    TSocketError,
    TSocketResponseData,
    TActiveSymbolsRequest,
    TActiveSymbolsResponse,
    TAuthorizeRequest,
    TAuthorizeResponse,
    TBalanceRequest,
    TBalanceResponse,
    TBuyContractRequest,
    TBuyContractResponse,
    TCancelAContractRequest,
    TCancelAContractResponse,
    TContractsForSymbolRequest,
    TContractsForSymbolResponse,
    TLogOutRequest,
    TLogOutResponse,
    TPriceProposalRequest,
    TPriceProposalResponse,
    TPriceProposalOpenContractsRequest,
    TPriceProposalOpenContractsResponse,
    TSellContractRequest,
    TSellContractResponse,
    TUpdateContractRequest,
    TUpdateContractResponse,
    TUpdateContractHistoryRequest,
    TUpdateContractHistoryResponse,
    TStatementRequest,
    TStatementResponse,
    TProfitTableRequest,
    TProfitTableResponse,
    TPortfolioRequest,
    TPortfolioResponse,
    TTransactionsStreamRequest,
    TTransactionsStreamResponse,
    TTradingTimesRequest,
    TTradingTimesResponse,
    TTicksHistoryRequest,
    TTicksHistoryResponse,
    TTicksStreamRequest,
    TTicksStreamResponse,
    TServerTimeRequest,
    TServerTimeResponse,
    TForgetRequest,
    TForgetResponse,
    TForgetAllRequest,
    TForgetAllResponse,
    TDerivativesAccount,
    TDerivativesAccountResponse,
    TAutoRun,
    TAutoStopReasonCode,
    TAutoContractItem,
    TAutoContractTemplate,
    TAutoStrategyDescriptor,
    TAutoStrategyParameterProperty,
    TAutoStrategyParametersSchema,
    TAutoListStrategiesRequest,
    TAutoListStrategiesResponse,
    TAutoStartRequest,
    TAutoStartResponse,
    TAutoListRequest,
    TAutoListResponse,
    TAutoGetRequest,
    TAutoGetResponse,
    TAutoStopRequest,
    TAutoStopResponse,
    TAutoPauseRequest,
    TAutoPauseResponse,
    TAutoResumeRequest,
    TAutoResumeResponse,
} from '../types';
