package com.project.springboot_backend.controller;

import com.project.springboot_backend.kafka.SseService;
import com.project.springboot_backend.model.EmployeeEventLog;
import com.project.springboot_backend.repository.EmployeeEventLogRepository;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
public class SseController {
    
    private final SseService sseService;
    private final EmployeeEventLogRepository employeeEventLogRepository;

    public SseController(SseService sseService, EmployeeEventLogRepository employeeEventLogRepository) {
        this.sseService = sseService;
        this.employeeEventLogRepository = employeeEventLogRepository;
    }

    @GetMapping(value = {"/api/events", "/api/v1/employees/events"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter getEmployeeEvents() {
        return sseService.createEmitter();
    }

    @GetMapping("/api/events/history")
    public List<EmployeeEventLog> getEventHistory() {
        return employeeEventLogRepository.findTop5ByOrderByTimestampDesc();
    }
}
