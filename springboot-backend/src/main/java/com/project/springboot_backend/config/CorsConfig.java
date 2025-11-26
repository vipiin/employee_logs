package com.project.springboot_backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsMvcConfigurer(){
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry c){
                c.addMapping("/api/**")
                .allowedOrigins("https://employee-logs-fr.netlify.app")
                .allowedMethods("GET","PUT","DELETE","POST","UPDATE","OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
            }
        };
    }
}
