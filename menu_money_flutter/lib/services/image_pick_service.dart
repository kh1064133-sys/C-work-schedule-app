// 이미지 선택 서비스
// 카메라 촬영 또는 갤러리에서 이미지를 가져옵니다

import 'dart:io'; // File 클래스 사용
import 'package:image_picker/image_picker.dart'; // 이미지 선택 패키지

/// 이미지 선택 서비스 클래스
class ImagePickService {
  // ImagePicker 인스턴스 (한 번만 생성하여 재사용)
  final _picker = ImagePicker();

  /// 카메라로 사진 촬영
  /// 반환: 촬영한 이미지 파일 (취소 시 null)
  Future<File?> pickFromCamera() async {
    final xFile = await _picker.pickImage(
      source: ImageSource.camera, // 카메라 실행
      imageQuality: 85, // 품질 85% (용량 절약)
    );
    // XFile → File 변환 (null이면 취소됨)
    return xFile != null ? File(xFile.path) : null;
  }

  /// 갤러리(앨범)에서 사진 선택
  /// 반환: 선택한 이미지 파일 (취소 시 null)
  Future<File?> pickFromGallery() async {
    final xFile = await _picker.pickImage(
      source: ImageSource.gallery, // 갤러리 열기
      imageQuality: 85, // 품질 85%
    );
    return xFile != null ? File(xFile.path) : null;
  }
}
