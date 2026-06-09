package com.project.springboot_backend.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.springboot_backend.model.EmployeeEventLog;
import com.project.springboot_backend.repository.EmployeeEventLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class KafkaConsumerService {
    private static final Logger logger = LoggerFactory.getLogger(KafkaConsumerService.class);
    
    private final SseService sseService;
    private final ObjectMapper objectMapper;
    private final EmployeeEventLogRepository employeeEventLogRepository;

    public KafkaConsumerService(SseService sseService, ObjectMapper objectMapper, EmployeeEventLogRepository employeeEventLogRepository) {
        this.sseService = sseService;
        this.objectMapper = objectMapper;
        this.employeeEventLogRepository = employeeEventLogRepository;
    }

    @KafkaListener(topics = "${employee.events.topic:employee-events}", groupId = "${spring.kafka.consumer.group-id:employee-events-group}")
    public void consume(String message) {
        logger.info("Received Kafka event message: {}", message);
        try {
            EmployeeEvent event = objectMapper.readValue(message, EmployeeEvent.class);
            logger.info("Deserialized event: type={}, id={}", event.getEventType(), event.getEmployeeId());
            
            // Persist the event to Postgres database
            String employeeName = "";
            if (event.getEmployee() != null) {
                employeeName = (event.getEmployee().getFirstName() + " " + event.getEmployee().getLastName()).trim();
            } else {
                employeeName = "Employee " + event.getEmployeeId();
            }
            
            EmployeeEventLog log = new EmployeeEventLog(
                event.getEventType(),
                event.getTimestamp() != null ? event.getTimestamp() : java.time.LocalDateTime.now(),
                event.getEmployeeId(),
                employeeName
            );
            employeeEventLogRepository.save(log);
            logger.info("Persisted event log to database for employee: {}", event.getEmployeeId());
            
            // Broadcast via SSE
            sseService.broadcast(event);
        } catch (Exception e) {
            logger.error("Failed to process Kafka message: {}", message, e);
        }
    }
}
