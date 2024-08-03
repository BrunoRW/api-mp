let process_lines = [];

let client_lines = [];

const push_line = (webhook, code) => {
    let data = {
        webhook: webhook,
        code: code,
        status: false,
    }
    process_lines.push(data);
}

const push_client = (token, collector, code) => {
    let data = {
        token: token,
        collector: collector,
        code: code
    }

    client_lines.push(data)
}

const get_lines = () => {
    return process_lines;
}

const get_clients = () => {
    return client_lines;
}

export {
    push_line,
    push_client,
    get_lines,
    get_clients,
}