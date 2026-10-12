package com.dedsafio.mod.net;

import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

/**
 * Reto que el servidor envía al cliente al conectarse. El cliente responde con
 * {@link LicensePayload} firmado con la licencia emitida por el backend.
 */
public record HandshakePayload(String nonce, String serverId, String manifestVersion)
        implements CustomPayload {

    public static final CustomPayload.Id<HandshakePayload> ID =
            new CustomPayload.Id<>(Identifier.of("dedsafio", "handshake"));

    public static final PacketCodec<RegistryByteBuf, HandshakePayload> CODEC = PacketCodec.tuple(
            PacketCodecs.STRING, HandshakePayload::nonce,
            PacketCodecs.STRING, HandshakePayload::serverId,
            PacketCodecs.STRING, HandshakePayload::manifestVersion,
            HandshakePayload::new);

    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() {
        return ID;
    }
}
