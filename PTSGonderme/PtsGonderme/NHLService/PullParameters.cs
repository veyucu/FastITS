// Decompiled with JetBrains decompiler
// Type: PtsGonderme.NHLService.PullParameters
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;
using System.Xml.Serialization;

#nullable disable
namespace PtsGonderme.NHLService
{
  [GeneratedCode("System.Xml", "4.8.4084.0")]
  [DebuggerStepThrough]
  [DesignerCategory("code")]
  [XmlType(Namespace = "http://tempuri.org/")]
  [Serializable]
  public class PullParameters
  {
    private string serviceNameField;
    private PullDataRowItem[] conditionsField;

    public string ServiceName
    {
      get => this.serviceNameField;
      set => this.serviceNameField = value;
    }

    public PullDataRowItem[] Conditions
    {
      get => this.conditionsField;
      set => this.conditionsField = value;
    }
  }
}
