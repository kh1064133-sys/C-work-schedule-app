// MenuMoney 앱 메인 진입점
import 'package:flutter/material.dart';
import 'screens/home_screen.dart'; // 홈 화면

void main() {
  runApp(const MenuMoneyApp()); // 앱 실행
}

class MenuMoneyApp extends StatelessWidget {
  const MenuMoneyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MenuMoney', // 앱 이름
      debugShowCheckedModeBanner: false, // 우측 상단 DEBUG 배너 숨김
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true, // Material 3 디자인
      ),
      home: const HomeScreen(), // 시작 화면 = 홈 화면
    );
  }
}
