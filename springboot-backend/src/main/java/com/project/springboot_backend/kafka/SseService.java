package com.project.springboot_backend.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseService {
    private static final Logger logger = LoggerFactory.getLogger(SseService.class);
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter createEmitter() {
        // Create an emitter with a long timeout (e.g., 30 minutes)
        SseEmitter emitter = new SseEmitter(1800000L);
        
        emitters.add(emitter);
        logger.info("Added new SSE emitter. Total connections: {}", emitters.size());

        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            logger.info("SSE emitter completed. Total connections: {}", emitters.size());
        });

        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            logger.info("SSE emitter timed out. Total connections: {}", emitters.size());
        });

        emitter.onError((ex) -> {
            emitters.remove(emitter);
            logger.info("SSE emitter error. Total connections: {}", emitters.size());
        });

        // Send an initial connection status event
        try {
            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data("Connected to Employee Log Events Stream"));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }

        return emitter;
    }

    public void broadcast(EmployeeEvent event) {
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        
        for (SseEmitter emitter : emitters) {
            try {
                // Send an event with data
                emitter.send(event);
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }
        
        if (!deadEmitters.isEmpty()) {
            emitters.removeAll(deadEmitters);
            logger.info("Removed {} dead SSE emitters. Active: {}", deadEmitters.size(), emitters.size());
        }
    }
}
