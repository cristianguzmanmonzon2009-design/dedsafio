package com.dedsafio.mod;

import com.dedsafio.mod.net.HandshakePayload;
import com.dedsafio.mod.net.LicensePayload;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.stream.Collectors;

/**
 * Lado cliente: responde al reto del servidor con la licencia emitida por el
 * launcher (variable de entorno {@code DEDSAFIO_LICENSE}) y la lista de mods.
 */
public class DedsafioClient implements ClientModInitializer {

    private static final Logger LOGGER = LoggerFactory.getLogger("dedsafio-client");

    @Override
    public void onInitializeClient() {
        ClientPlayNetworking.registerGlobalReceiver(HandshakePayload.ID, (payload, context) ->
                context.client().execute(() -> respond(payload)));
    }

    private void respond(HandshakePayload payload) {
        String token = env("DEDSAFIO_LICENSE", "");
        if (token.isBlank()) {
            LOGGER.error("[Dedsafio] No se recibió licencia (DEDSAFIO_LICENSE). ¿Abriste el juego con el launcher?");
            return;
        }
        String hardwareId = env("DEDSAFIO_HWID", "unknown-hw-00000000");
        String username = MinecraftClient.getInstance().getSession().getUsername();
        String mods = FabricLoader.getInstance().getAllMods().stream()
                .map(m -> m.getMetadata().getId())
                .collect(Collectors.joining(","));

        ClientPlayNetworking.send(new LicensePayload(
                payload.nonce(),
                token,
                hardwareId,
                username,
                payload.manifestVersion(),
                mods));
        LOGGER.info("[Dedsafio] Licencia enviada al servidor");
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return v == null ? fallback : v;
    }
}
