import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import type { ClienteStatus } from "../mockRede";

type RedeClient = SupabaseClient<Database>;
type ClienteRow = Database["public"]["Tables"]["rede_clientes"]["Row"];

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  status: ClienteStatus;
  etiquetas: string[];
  ultimoContato: string;
  observacoes: string;
};

function paraCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    status: row.status as ClienteStatus,
    etiquetas: row.etiquetas,
    ultimoContato: row.ultimo_contato,
    observacoes: row.observacoes,
  };
}

async function obterUsuarioId(client: RedeClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  return user.id;
}

export type CriarClienteInput = {
  nome: string;
  telefone?: string;
  status?: ClienteStatus;
  etiquetas?: string[];
  observacoes?: string;
};

export async function criarCliente(
  client: RedeClient,
  input: CriarClienteInput
): Promise<Cliente> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_clientes")
    .insert({
      user_id: userId,
      nome: input.nome.trim(),
      telefone: input.telefone,
      status: input.status,
      etiquetas: input.etiquetas,
      observacoes: input.observacoes,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return paraCliente(data);
}

export type AtualizarClienteInput = {
  clienteId: string;
  nome: string;
  telefone: string;
  status: ClienteStatus;
  etiquetas: string[];
  observacoes: string;
};

export async function atualizarCliente(
  client: RedeClient,
  input: AtualizarClienteInput
): Promise<Cliente> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_clientes")
    .update({
      nome: input.nome.trim(),
      telefone: input.telefone,
      status: input.status,
      etiquetas: input.etiquetas,
      observacoes: input.observacoes,
    })
    .eq("id", input.clienteId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return paraCliente(data);
}

export async function listarClientes(
  client: RedeClient,
  userId: string
): Promise<Cliente[]> {
  const { data, error } = await client
    .from("rede_clientes")
    .select("*")
    .eq("user_id", userId)
    .order("criado_em", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(paraCliente);
}

export type ExcluirClienteInput = {
  clienteId: string;
};

export async function excluirCliente(
  client: RedeClient,
  input: ExcluirClienteInput
): Promise<void> {
  const userId = await obterUsuarioId(client);
  const { error } = await client
    .from("rede_clientes")
    .delete()
    .eq("id", input.clienteId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
