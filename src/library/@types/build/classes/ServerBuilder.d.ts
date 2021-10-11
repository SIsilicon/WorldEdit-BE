export interface runCommandReturn {
    error: boolean,
    statusCode?: number,
    statusMessage?: string,
    playerTest?: Array<string>,
    players?: string
}