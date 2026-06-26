import type { Job, Meta, Usuario } from "./types";

export const mockUsuario: Usuario = {
  id: "mock-user",
  nome: "Miguel",
  email: "alissonrsilva20@gmail.com",
};

export const mockJobs: Job[] = [
  {
    id: "1",
    clienteNome: "Ana Paula",
    data: "2026-06-27",
    hora: "14:00",
    valor: 150,
    modalidade: "presencial",
    local: "Rua das Flores, 123",
    status: "confirmado",
    observacoes: "Levar notebook para demonstração",
    criadoEm: new Date().toISOString(),
  },
  {
    id: "2",
    clienteNome: "Carlos Lima",
    data: "2026-06-30",
    hora: "10:00",
    valor: 200,
    modalidade: "online",
    status: "agendado",
    criadoEm: new Date().toISOString(),
  },
  {
    id: "3",
    clienteNome: "Beatriz Santos",
    data: "2026-06-25",
    hora: "09:00",
    valor: 180,
    modalidade: "presencial",
    local: "Studio Center",
    status: "concluído",
    criadoEm: new Date().toISOString(),
  },
  {
    id: "4",
    clienteNome: "Diego Ferreira",
    data: "2026-06-20",
    hora: "16:00",
    valor: 250,
    modalidade: "online",
    status: "concluído",
    criadoEm: new Date().toISOString(),
  },
];

export const mockMetas: Meta[] = [
  { periodo: "dia", valorAlvo: 300 },
  { periodo: "mes", valorAlvo: 3000 },
  { periodo: "ano", valorAlvo: 36000 },
];
