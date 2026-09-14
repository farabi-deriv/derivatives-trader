export type TGetContractPath = (contract_id?: number) => string;

export type TToastConfig = {
    key: string;
    content: string | React.ReactNode;
    is_bottom?: boolean;
    timeout?: number;
    type: string;
};
