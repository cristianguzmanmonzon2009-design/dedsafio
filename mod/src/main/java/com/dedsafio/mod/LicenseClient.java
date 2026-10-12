package com.dedsafio.mod;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Cliente HTTP mínimo contra el backend de Dedsafio para validar licencias.
 * La URL se toma de la propiedad de sistema {@code dedsafio.apiUrl} o de la
 * variable de entorno {@code DEDSAFIO_API_URL}.
 */
public final class LicenseClient {

    private static final Gson GSON = new Gson();
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private LicenseClient() {
    }

    public static String apiUrl() {
        String prop = System.getProperty("dedsafio.apiUrl");
        if (prop != null && !prop.isBlank()) {
            return prop;
        }
        String env = System.getenv("DEDSAFIO_API_URL");
        if (env != null && !env.isBlank()) {
            return env;
        }
        return "https://dedsafio-backend-ucvk.onrender.com";
    }

    public record Result(boolean valid, String reason) {
    }

    public static Result validate(String licenseToken, String hardwareId, String serverId,
                                  String connectedAddress) {
        try {
            JsonObject body = new JsonObject();
            body.addProperty("token", licenseToken);
            body.addProperty("hardwareId", hardwareId);
            body.addProperty("serverId", serverId);
            if (connectedAddress != null && !connectedAddress.isBlank()) {
                body.addProperty("connectedAddress", connectedAddress);
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl() + "/api/v1/license/validate"))
                    .timeout(Duration.ofSeconds(8))
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body)))
                    .build();

            HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return new Result(false, "http_" + response.statusCode());
            }
            JsonObject json = GSON.fromJson(response.body(), JsonObject.class);
            boolean valid = json.has("valid") && json.get("valid").getAsBoolean();
            String reason = json.has("reason") && !json.get("reason").isJsonNull()
                    ? json.get("reason").getAsString()
                    : (valid ? "ok" : "invalid");
            return new Result(valid, reason);
        } catch (Exception e) {
            return new Result(false, "backend_unreachable");
        }
    }
}
