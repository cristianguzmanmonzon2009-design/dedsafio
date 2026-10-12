package com.dedsafio.mod;

import com.dedsafio.mod.net.HandshakePayload;
import com.dedsafio.mod.net.LicensePayload;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Guardia del servidor: exige que cada cliente complete el handshake de
 * licencia contra el backend y traiga el conjunto de mods esperado.
 */
public class DedsafioMod implements ModInitializer {

    public static final String MOD_ID = "dedsafio";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private static final String SERVER_ID =
            env("DEDSAFIO_SERVER_ID", "endersafio");
    private static final String MANIFEST_VERSION =
            env("DEDSAFIO_MANIFEST_VERSION", "");
    /** Ids de mods que el cliente DEBE traer. Vacío = no se comprueba. */
    private static final Set<String> EXPECTED_MODS = parseSet(
            env("DEDSAFIO_EXPECTED_MODS", ""));

    private static final Map<UUID, String> PENDING = new ConcurrentHashMap<>();

    @Override
    public void onInitialize() {
        PayloadTypeRegistry.playS2C().register(HandshakePayload.ID, HandshakePayload.CODEC);
        PayloadTypeRegistry.playC2S().register(LicensePayload.ID, LicensePayload.CODEC);

        ServerPlayNetworking.registerGlobalReceiver(LicensePayload.ID, (payload, context) ->
                context.server().execute(() -> handleLicense(context.player(), payload)));

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.player;
            String nonce = UUID.randomUUID().toString();
            PENDING.put(player.getUuid(), nonce);
            ServerPlayNetworking.send(player, new HandshakePayload(nonce, SERVER_ID, MANIFEST_VERSION));
        });

        ServerPlayConnectionEvents.DISCONNECT.register(
                (handler, server) -> PENDING.remove(handler.player.getUuid()));

        LOGGER.info("[Dedsafio] Guard activo. serverId={} modsEsperados={}",
                SERVER_ID, EXPECTED_MODS.size());
    }

    private void handleLicense(ServerPlayerEntity player, LicensePayload payload) {
        String expectedNonce = PENDING.remove(player.getUuid());
        if (expectedNonce == null || !expectedNonce.equals(payload.nonce())) {
            deny(player, "Handshake inválido");
            return;
        }
        if (!MANIFEST_VERSION.isBlank() && !MANIFEST_VERSION.equals(payload.manifestVersion())) {
            deny(player, "Versión de mods desactualizada. Actualiza el launcher.");
            return;
        }
        if (!EXPECTED_MODS.isEmpty()) {
            Set<String> loaded = parseSet(payload.mods());
            if (!loaded.containsAll(EXPECTED_MODS)) {
                deny(player, "Faltan mods obligatorios de Dedsafio.");
                return;
            }
        }
        LicenseClient.Result result = LicenseClient.validate(
                payload.licenseToken(),
                payload.hardwareId(),
                SERVER_ID,
                player.getIp());
        if (!result.valid()) {
            LOGGER.warn("[Dedsafio] Licencia rechazada para {} ({})", payload.username(), result.reason());
            deny(player, "Licencia inválida: " + result.reason());
            return;
        }
        LOGGER.info("[Dedsafio] {} autorizado", payload.username());
    }

    private static void deny(ServerPlayerEntity player, String reason) {
        player.networkHandler.disconnect(Text.literal("[Dedsafio] " + reason));
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return v == null ? fallback : v;
    }

    private static Set<String> parseSet(String csv) {
        Set<String> out = new HashSet<>();
        if (csv != null && !csv.isBlank()) {
            Arrays.stream(csv.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(out::add);
        }
        return out;
    }
}
