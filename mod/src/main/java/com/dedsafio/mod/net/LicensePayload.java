package com.dedsafio.mod.net;

import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

/**
 * Respuesta del cliente: licencia emitida por el backend más identidad y lista
 * de mods cargados (ids separados por comas). El servidor la valida contra la API.
 */
public record LicensePayload(
        String nonce,
        String licenseToken,
        String hardwareId,
        String username,
        String manifestVersion,
        String mods) implements CustomPayload {

    public static final CustomPayload.Id<LicensePayload> ID =
            new CustomPayload.Id<>(Identifier.of("dedsafio", "license"));

    public static final PacketCodec<RegistryByteBuf, LicensePayload> CODEC = PacketCodec.tuple(
            PacketCodecs.STRING, LicensePayload::nonce,
            PacketCodecs.STRING, LicensePayload::licenseToken,
            PacketCodecs.STRING, LicensePayload::hardwareId,
            PacketCodecs.STRING, LicensePayload::username,
            PacketCodecs.STRING, LicensePayload::manifestVersion,
            PacketCodecs.STRING, LicensePayload::mods,
            LicensePayload::new);

    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() {
        return ID;
    }
}
