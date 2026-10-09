// Express 4 não espera a promise do handler: rota `async` que rejeita (banco fora, por exemplo) vira
// rejeição não tratada e o Node ENCERRA o processo. O `ah` entrega o erro ao middleware de erro do
// app.js, que responde 500 e mantém o servidor de pé. Toda rota async passa por ele
// (test/erro-de-banco.mjs trava isso).
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
