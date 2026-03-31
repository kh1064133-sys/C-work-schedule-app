// 홈 화면 (메인 화면)
// 4개 서비스를 통합하여 메뉴판 촬영 → OCR → 번역 → 환율변환 전체 흐름을 처리합니다
//
// 동작 순서:
// 1. 카메라 촬영 또는 앨범에서 사진 선택
// 2. 이미지에서 OCR로 텍스트 인식
// 3. 금액은 원화로 변환, 메뉴명은 한국어로 번역
// 4. 결과를 리스트로 화면에 표시

import 'dart:io'; // File 클래스
import 'package:flutter/material.dart'; // Flutter UI 위젯

// 우리가 만든 4개 서비스 import
import '../services/image_pick_service.dart'; // 이미지 선택
import '../services/ocr_service.dart'; // 텍스트 인식
import '../services/translation_service.dart'; // 번역
import '../services/exchange_rate_service.dart'; // 환율 변환

/// 변환 완료된 메뉴 항목 (화면에 표시할 최종 데이터)
class ConvertedMenuItem {
  final String originalName; // 원본 메뉴 이름 (예: "Pad Thai")
  final String translatedName; // 번역된 이름 (예: "팟타이")
  final double? originalPrice; // 원본 가격 (예: 12.99)
  final String? originalCurrency; // 원본 통화 기호 (예: "$")
  final double? krwPrice; // 원화 가격 (예: 17283)
  final bool hasPrice; // 가격이 있는지 여부

  // 생성자
  ConvertedMenuItem({
    required this.originalName,
    required this.translatedName,
    this.originalPrice,
    this.originalCurrency,
    this.krwPrice,
    this.hasPrice = false,
  });
}

/// 홈 화면 위젯 (StatefulWidget - 상태가 변하는 화면)
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

/// 홈 화면의 상태 관리 클래스
class _HomeScreenState extends State<HomeScreen> {
  // ── 서비스 인스턴스 생성 ──
  final _imagePickService = ImagePickService(); // 이미지 선택 서비스
  final _ocrService = OcrService(); // OCR 서비스
  final _translationService = TranslationService(); // 번역 서비스
  final _exchangeRateService = ExchangeRateService(); // 환율 서비스

  // ── 화면 상태 변수 ──
  List<ConvertedMenuItem> _menuItems = []; // 변환 완료된 메뉴 목록
  bool _isProcessing = false; // 처리 중 여부 (로딩 표시용)
  String _statusMessage = ''; // 현재 진행 상태 메시지
  String? _errorMessage; // 에러 메시지 (에러 발생 시)
  File? _selectedImage; // 선택한 이미지 파일 (미리보기용)

  /// 화면이 처음 생성될 때 호출
  @override
  void initState() {
    super.initState();
    _initServices(); // 서비스 초기화
  }

  /// 서비스 초기화 (환율 데이터 미리 로드)
  Future<void> _initServices() async {
    // 환율 데이터를 미리 가져와 둠 (나중에 변환 시 빠르게 사용)
    await _exchangeRateService.refreshRates();
  }

  /// 화면이 제거될 때 호출 (메모리 정리)
  @override
  void dispose() {
    _ocrService.dispose(); // OCR 리소스 해제
    _translationService.dispose(); // 번역 리소스 해제
    super.dispose();
  }

  /// ★ 핵심 메서드: 전체 처리 파이프라인 실행
  /// 이미지 → OCR → 번역 + 환율변환 → 결과 표시
  Future<void> _processImage(File imageFile) async {
    // 처리 시작 - UI 상태 업데이트
    setState(() {
      _isProcessing = true; // 로딩 시작
      _statusMessage = '텍스트 인식 중...'; // 상태 메시지
      _errorMessage = null; // 이전 에러 초기화
      _menuItems = []; // 이전 결과 초기화
      _selectedImage = imageFile; // 미리보기용 이미지 저장
    });

    // ── 1단계: OCR (텍스트 인식) ──
    final ocrResult = await _ocrService.recognizeText(imageFile);

    // OCR 실패 체크
    if (!ocrResult.success) {
      setState(() {
        _isProcessing = false;
        _errorMessage = ocrResult.errorMessage ?? '텍스트 인식에 실패했습니다.';
      });
      return; // 여기서 중단
    }

    // 인식된 메뉴가 없는 경우
    if (ocrResult.menuItems.isEmpty) {
      setState(() {
        _isProcessing = false;
        _errorMessage = '메뉴판에서 텍스트를 찾지 못했습니다.\n다른 각도로 다시 촬영해보세요.';
      });
      return;
    }

    // ── 2단계: 번역 + 환율변환 (동시 처리) ──
    setState(() {
      _statusMessage = '번역 및 환율 변환 중...'; // 상태 업데이트
    });

    final convertedItems = <ConvertedMenuItem>[]; // 결과 담을 리스트

    for (final item in ocrResult.menuItems) {
      // 메뉴 이름 번역 (빈 이름이 아닌 경우만)
      String translatedName = item.name;
      if (item.name.isNotEmpty && item.name != '(메뉴이름 없음)') {
        final translationResult = await _translationService.translateToKorean(
          item.name,
        );
        if (translationResult.success) {
          translatedName = translationResult.translatedText;
        }
      }

      // 금액이 있으면 원화로 변환
      double? krwPrice;
      if (item.hasPrice && item.price != null) {
        final currency = item.currency ?? '\$'; // 기본값: 달러
        final conversion = await _exchangeRateService.convertToKRW(
          item.price!,
          currency,
        );
        if (conversion.success) {
          krwPrice = conversion.convertedAmount;
        }
      }

      // 변환 완료된 항목 추가
      convertedItems.add(ConvertedMenuItem(
        originalName: item.name,
        translatedName: translatedName,
        originalPrice: item.price,
        originalCurrency: item.currency,
        krwPrice: krwPrice,
        hasPrice: item.hasPrice,
      ));
    }

    // ── 3단계: 결과를 화면에 표시 ──
    setState(() {
      _menuItems = convertedItems; // 결과 저장
      _isProcessing = false; // 로딩 종료
      _statusMessage = ''; // 상태 메시지 초기화
    });
  }

  /// 카메라 촬영 버튼 클릭 핸들러
  Future<void> _onCameraPressed() async {
    final file = await _imagePickService.pickFromCamera();
    if (file != null) {
      await _processImage(file); // 촬영 성공 시 처리 시작
    }
  }

  /// 갤러리 선택 버튼 클릭 핸들러
  Future<void> _onGalleryPressed() async {
    final file = await _imagePickService.pickFromGallery();
    if (file != null) {
      await _processImage(file); // 선택 성공 시 처리 시작
    }
  }

  // ══════════════════════════════════════════
  // UI 빌드 메서드들
  // ══════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // ── 앱 바 (상단 바) ──
      appBar: AppBar(
        title: const Text('💱 MenuMoney'), // 앱 제목
        centerTitle: true,
        backgroundColor: Colors.blue.shade600,
        foregroundColor: Colors.white,
        elevation: 0,
      ),

      // ── 본문 영역 ──
      body: SafeArea(
        child: Column(
          children: [
            // 이미지 미리보기 + 버튼 영역
            _buildTopSection(),

            // 구분선
            const Divider(height: 1),

            // 결과 리스트 영역 (스크롤 가능)
            Expanded(
              child: _buildResultSection(),
            ),
          ],
        ),
      ),

      // ── 하단 버튼 (카메라/갤러리) ──
      bottomNavigationBar: _buildBottomButtons(),
    );
  }

  /// 상단 영역: 이미지 미리보기 또는 안내 메시지
  Widget _buildTopSection() {
    return Container(
      width: double.infinity,
      color: Colors.grey.shade100,
      child: _selectedImage != null
          // 이미지가 있으면 미리보기 표시
          ? SizedBox(
              height: 200,
              child: Image.file(
                _selectedImage!, // 선택한 이미지
                fit: BoxFit.cover, // 영역에 맞게 자르기
                width: double.infinity,
              ),
            )
          // 이미지가 없으면 안내 메시지 표시
          : const SizedBox(
              height: 200,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.restaurant_menu, size: 64, color: Colors.grey),
                    SizedBox(height: 12),
                    Text(
                      '메뉴판을 촬영하거나\n갤러리에서 선택하세요',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  /// 결과 영역: 로딩, 에러, 빈 상태, 결과 리스트 중 하나를 표시
  Widget _buildResultSection() {
    // 처리 중이면 로딩 표시
    if (_isProcessing) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(), // 로딩 스피너
            const SizedBox(height: 16),
            Text(
              _statusMessage, // "텍스트 인식 중..." 등
              style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
            ),
          ],
        ),
      );
    }

    // 에러가 있으면 에러 메시지 표시
    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(
                _errorMessage!, // 에러 메시지
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, color: Colors.red),
              ),
            ],
          ),
        ),
      );
    }

    // 결과가 없으면 빈 상태 표시
    if (_menuItems.isEmpty) {
      return const Center(
        child: Text(
          '아직 결과가 없습니다',
          style: TextStyle(fontSize: 16, color: Colors.grey),
        ),
      );
    }

    // ── 결과 리스트 표시 ──
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _menuItems.length, // 항목 개수
      separatorBuilder: (_, __) => const SizedBox(height: 8), // 항목 간 간격
      itemBuilder: (context, index) {
        final item = _menuItems[index]; // 현재 항목
        return _buildMenuCard(item); // 카드 위젯 생성
      },
    );
  }

  /// 메뉴 항목 카드 위젯
  /// 메뉴명(번역) + 원본 금액 + 원화 변환 금액을 표시
  Widget _buildMenuCard(ConvertedMenuItem item) {
    return Card(
      elevation: 2, // 그림자 깊이
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12), // 둥근 모서리
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, // 왼쪽 정렬
          children: [
            // ── 메뉴 이름 (번역된 한국어) ──
            Text(
              item.translatedName, // 예: "팟타이"
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),

            // 원본 이름이 번역과 다르면 원본도 표시
            if (item.originalName != item.translatedName) ...[
              const SizedBox(height: 4),
              Text(
                item.originalName, // 예: "Pad Thai"
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade500,
                  fontStyle: FontStyle.italic, // 기울임꼴
                ),
              ),
            ],

            // ── 가격 영역 (가격이 있을 때만 표시) ──
            if (item.hasPrice) ...[
              const SizedBox(height: 12),
              // 구분선
              Divider(color: Colors.grey.shade200, height: 1),
              const SizedBox(height: 12),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // 원본 가격 (왼쪽)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '원본 가격',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${item.originalCurrency ?? ""}${item.originalPrice?.toStringAsFixed(2) ?? ""}',
                        // 예: "$12.99"
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),

                  // 화살표 아이콘
                  Icon(
                    Icons.arrow_forward,
                    color: Colors.blue.shade400,
                    size: 20,
                  ),

                  // 원화 가격 (오른쪽)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '원화',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.krwPrice != null
                            ? ExchangeRateService.formatKRW(item.krwPrice!)
                            : '변환 실패',
                        // 예: "₩17,283"
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: item.krwPrice != null
                              ? Colors.blue.shade700
                              : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// 하단 버튼 영역: 카메라 촬영 / 갤러리 선택
  Widget _buildBottomButtons() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), // 하단 여백 크게
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1), // 상단 그림자
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          // 카메라 버튼 (왼쪽)
          Expanded(
            child: ElevatedButton.icon(
              onPressed: _isProcessing ? null : _onCameraPressed,
              // 처리 중이면 비활성화
              icon: const Icon(Icons.camera_alt),
              label: const Text('카메라 촬영'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade600,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),

          const SizedBox(width: 12), // 버튼 간 간격

          // 갤러리 버튼 (오른쪽)
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _isProcessing ? null : _onGalleryPressed,
              icon: const Icon(Icons.photo_library),
              label: const Text('앨범 선택'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.blue.shade600,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                side: BorderSide(color: Colors.blue.shade600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
