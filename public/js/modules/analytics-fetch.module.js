export function isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 20;
}

export async function fetchJson(url, { token, signal, method = 'GET', headers = {}, body } = {}) {
    const response = await fetch(url, {
        method,
        signal,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers
        },
        ...(body !== undefined ? { body } : {})
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        payload = null;
    }

    if (!response.ok) {
        const error = new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

export function createAbortableRequestManager() {
    const pageControllers = new Map();
    const localidadControllers = new Map();
    const puestoControllers = new Map();
    const prefetchControllers = new Map();

    function begin(map, key) {
        const current = map.get(key);
        if (current) {
            current.abort();
        }
        const controller = new AbortController();
        map.set(key, controller);
        return controller;
    }

    function release(map, key, controller) {
        if (map.get(key) === controller) {
            map.delete(key);
        }
    }

    function abortAll(map) {
        map.forEach((controller) => controller.abort());
        map.clear();
    }

    return {
        beginPageRequest(key = 'default') {
            return begin(pageControllers, key);
        },
        completePageRequest(key, controller) {
            release(pageControllers, key, controller);
        },
        abortPageRequest(key = 'default') {
            const current = pageControllers.get(key);
            if (current) current.abort();
            pageControllers.delete(key);
        },
        abortAllPageRequests() {
            abortAll(pageControllers);
        },
        beginLocalidadRequest(localidadId) {
            return begin(localidadControllers, localidadId);
        },
        completeLocalidadRequest(localidadId, controller) {
            release(localidadControllers, localidadId, controller);
        },
        abortLocalidadRequest(localidadId) {
            const current = localidadControllers.get(localidadId);
            if (current) current.abort();
            localidadControllers.delete(localidadId);
        },
        abortAllLocalidadRequests() {
            abortAll(localidadControllers);
        },
        beginPuestoRequest(puestoId) {
            return begin(puestoControllers, puestoId);
        },
        completePuestoRequest(puestoId, controller) {
            release(puestoControllers, puestoId, controller);
        },
        abortPuestoRequest(puestoId) {
            const current = puestoControllers.get(puestoId);
            if (current) current.abort();
            puestoControllers.delete(puestoId);
        },
        abortAllPuestoRequests() {
            abortAll(puestoControllers);
        },
        beginPrefetchRequest(key) {
            return begin(prefetchControllers, key);
        },
        completePrefetchRequest(key, controller) {
            release(prefetchControllers, key, controller);
        },
        abortPrefetchRequest(key) {
            const current = prefetchControllers.get(key);
            if (current) current.abort();
            prefetchControllers.delete(key);
        },
        abortAllPrefetchRequests() {
            abortAll(prefetchControllers);
        },
        abortAllHierarchyRequests() {
            abortAll(localidadControllers);
            abortAll(puestoControllers);
            abortAll(prefetchControllers);
        }
    };
}

